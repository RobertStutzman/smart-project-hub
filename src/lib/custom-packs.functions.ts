import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PACK_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

function generatePackCode() {
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += PACK_CODE_ALPHABET[Math.floor(Math.random() * PACK_CODE_ALPHABET.length)];
  }
  return out;
}

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Admin access required");
}

// ---------- PUBLIC: submit an order ----------
export const submitCustomOrder = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      customerName: z.string().trim().min(1).max(120),
      customerEmail: z.string().trim().email().max(255),
      eventType: z.enum(["wedding", "bachelorette", "bachelor", "birthday", "roast", "anniversary", "other"]),
      eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      honoreeNames: z.string().trim().min(1).max(200),
      questionCount: z.number().int().min(5).max(50),
      tone: z.enum(["clean", "medium", "spicy", "roast"]),
      intake: z.object({
        childhood: z.string().max(2000).optional().default(""),
        relationships: z.string().max(2000).optional().default(""),
        embarrassing: z.string().max(2000).optional().default(""),
        insideJokes: z.string().max(2000).optional().default(""),
        hobbies: z.string().max(2000).optional().default(""),
        achievements: z.string().max(2000).optional().default(""),
        anythingElse: z.string().max(4000).optional().default(""),
      }),
    }).parse,
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("custom_orders")
      .insert({
        customer_name: data.customerName,
        customer_email: data.customerEmail,
        event_type: data.eventType,
        event_date: data.eventDate ?? null,
        honoree_names: data.honoreeNames,
        question_count: data.questionCount,
        tone: data.tone,
        intake_payload: data.intake,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, orderId: row.id };
  });

// ---------- ADMIN: list orders ----------
export const listCustomOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("custom_orders")
      .select("*, pack:custom_packs!custom_orders_pack_fk(id, pack_code, title, is_active, expires_at, single_use, used_at)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { orders: data ?? [] };
  });

// ---------- ADMIN: get single order with pack + questions ----------
export const getCustomOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ orderId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin
      .from("custom_orders")
      .select("*, pack:custom_packs!custom_orders_pack_fk(*)")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Order not found");

    let questions: Array<Record<string, unknown>> = [];
    const pack = (order as { pack: { category_tag?: string } | null }).pack;
    if (pack?.category_tag) {
      const { data: qs } = await supabaseAdmin
        .from("questions")
        .select("*")
        .eq("category", pack.category_tag)
        .order("created_at", { ascending: true });
      questions = qs ?? [];
    }
    return { order, questions };
  });

// ---------- ADMIN: ensure a pack exists for the order ----------
async function ensurePackForOrder(orderId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: order } = await supabaseAdmin
    .from("custom_orders")
    .select("*, pack:custom_packs!custom_orders_pack_fk(*)")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) throw new Error("Order not found");
  if ((order as { pack: unknown }).pack) return (order as { pack: { id: string; pack_code: string; category_tag: string } }).pack;

  // Allocate a unique pack code
  let code = "";
  for (let i = 0; i < 8; i++) {
    code = generatePackCode();
    const { data: existing } = await supabaseAdmin
      .from("custom_packs")
      .select("id")
      .eq("pack_code", code)
      .maybeSingle();
    if (!existing) break;
    code = "";
  }
  if (!code) throw new Error("Could not allocate pack code");

  const categoryTag = `__custom__${code}`;
  const title = `${(order as { honoree_names: string }).honoree_names} — Custom Trivia`;
  const { data: pack, error: packErr } = await supabaseAdmin
    .from("custom_packs")
    .insert({
      order_id: orderId,
      pack_code: code,
      category_tag: categoryTag,
      title,
      is_active: false, // becomes active on approval
    })
    .select("id, pack_code, category_tag")
    .single();
  if (packErr) throw new Error(packErr.message);

  await supabaseAdmin
    .from("custom_orders")
    .update({ pack_id: pack.id, status: "drafting" })
    .eq("id", orderId);

  return pack;
}

// ---------- ADMIN: AI-draft questions for an order ----------
export const draftCustomQuestionsWithAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ orderId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const { data: order } = await supabaseAdmin
      .from("custom_orders")
      .select("*")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order) throw new Error("Order not found");

    const pack = await ensurePackForOrder(data.orderId);

    const o = order as {
      event_type: string;
      honoree_names: string;
      tone: string;
      question_count: number;
      intake_payload: Record<string, string>;
    };
    const toneCue =
      o.tone === "clean" ? "Keep everything wholesome and family-friendly. No crude humor."
      : o.tone === "medium" ? "Playful, light teasing. Nothing X-rated."
      : o.tone === "spicy" ? "Adult humor okay. Cheeky innuendo welcome. No slurs or actually mean content."
      : "Roast-level. Bold, savage, hilarious. Still no slurs, no truly mean-spirited attacks.";

    const intakeBlob = Object.entries(o.intake_payload || {})
      .filter(([, v]) => typeof v === "string" && v.trim().length > 0)
      .map(([k, v]) => `### ${k}\n${v}`)
      .join("\n\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You write CUSTOM multiple-choice trivia questions for a private party. Every question is about the specific people described in the user message. Each question has exactly one correct answer and three plausible-sounding wrong answers (fake but consistent in style). Add a 1-2 sentence 'explanation' that the host reads aloud after the reveal — funny and warm. Difficulty should mostly be 'medium' with some 'hard'. NEVER invent personal data outside what the user provided; if a topic isn't covered, skip it.",
          },
          {
            role: "user",
            content: `Event type: ${o.event_type}\nGuest(s) of honor: ${o.honoree_names}\nTone: ${o.tone} — ${toneCue}\n\nGenerate ${o.question_count} questions for this party.\n\n--- Intake info ---\n${intakeBlob || "(no extra info provided)"}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "emit_questions",
              description: "Return the custom trivia questions.",
              parameters: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        question_text: { type: "string" },
                        correct_answer: { type: "string" },
                        wrong_1: { type: "string" },
                        wrong_2: { type: "string" },
                        wrong_3: { type: "string" },
                        explanation: { type: "string" },
                        difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                      },
                      required: ["question_text", "correct_answer", "wrong_1", "wrong_2", "wrong_3", "explanation", "difficulty"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["questions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "emit_questions" } },
        max_completion_tokens: 8192,
      }),
    });

    if (res.status === 429) throw new Error("Rate limit hit, please slow down.");
    if (res.status === 402) throw new Error("AI credits exhausted — add funds in Cloud → Usage.");
    if (!res.ok) throw new Error(`AI gateway error ${res.status}`);
    const json = await res.json();
    const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("AI did not return structured output — try again.");
    const parsed = JSON.parse(args) as {
      questions: Array<{
        question_text: string;
        correct_answer: string;
        wrong_1: string;
        wrong_2: string;
        wrong_3: string;
        explanation: string;
        difficulty: "easy" | "medium" | "hard";
      }>;
    };

    const rows = parsed.questions.map((q) => ({
      category: pack.category_tag,
      question_text: q.question_text.trim().slice(0, 500),
      correct_answer: q.correct_answer.trim().slice(0, 200),
      wrong_1: q.wrong_1.trim().slice(0, 200),
      wrong_2: q.wrong_2.trim().slice(0, 200),
      wrong_3: q.wrong_3.trim().slice(0, 200),
      explanation: q.explanation.trim().slice(0, 400),
      difficulty: q.difficulty || "medium",
      is_premium: false,
    }));

    if (rows.length > 0) {
      const { error } = await supabaseAdmin.from("questions").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true, packCode: pack.pack_code, inserted: rows.length };
  });

// ---------- ADMIN: edit individual pack questions ----------
export const upsertCustomQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      packId: z.string().uuid(),
      question: z.object({
        id: z.string().uuid().optional(),
        question_text: z.string().min(1).max(500),
        correct_answer: z.string().min(1).max(200),
        wrong_1: z.string().min(1).max(200),
        wrong_2: z.string().min(1).max(200),
        wrong_3: z.string().min(1).max(200),
        explanation: z.string().max(400).optional().default(""),
        difficulty: z.enum(["easy", "medium", "hard", "impossible"]).default("medium"),
      }),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pack } = await supabaseAdmin
      .from("custom_packs")
      .select("category_tag")
      .eq("id", data.packId)
      .maybeSingle();
    if (!pack) throw new Error("Pack not found");
    const payload = { ...data.question, category: (pack as { category_tag: string }).category_tag };
    if (data.question.id) {
      const { error } = await supabaseAdmin.from("questions").update(payload).eq("id", data.question.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.question.id };
    }
    const { data: row, error } = await supabaseAdmin.from("questions").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const deleteCustomQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ questionId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("questions").delete().eq("id", data.questionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- ADMIN: approve & deliver ----------
export const approveAndDeliverPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      orderId: z.string().uuid(),
      singleUse: z.boolean().default(false),
      expiresAt: z.string().datetime().nullable().optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const pack = await ensurePackForOrder(data.orderId);
    const { error: e1 } = await supabaseAdmin
      .from("custom_packs")
      .update({
        is_active: true,
        single_use: data.singleUse,
        expires_at: data.expiresAt ?? null,
      })
      .eq("id", pack.id);
    if (e1) throw new Error(e1.message);
    const { error: e2 } = await supabaseAdmin
      .from("custom_orders")
      .update({ status: "ready", delivered_at: new Date().toISOString() })
      .eq("id", data.orderId);
    if (e2) throw new Error(e2.message);
    return { ok: true, packCode: pack.pack_code };
  });

export const markOrderDelivered = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ orderId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("custom_orders")
      .update({ status: "delivered" })
      .eq("id", data.orderId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- PUBLIC: look up a pack by code (used at room start) ----------
export const lookupCustomPack = createServerFn({ method: "POST" })
  .inputValidator(z.object({ packCode: z.string().trim().min(4).max(12) }).parse)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = data.packCode.toUpperCase();
    const { data: pack } = await supabaseAdmin
      .from("custom_packs")
      .select("id, pack_code, title, is_active, single_use, used_at, expires_at, category_tag")
      .eq("pack_code", code)
      .maybeSingle();
    if (!pack) return { ok: false as const, error: "Code not found" };
    const p = pack as {
      id: string;
      pack_code: string;
      title: string;
      is_active: boolean;
      single_use: boolean;
      used_at: string | null;
      expires_at: string | null;
      category_tag: string;
    };
    if (!p.is_active) return { ok: false as const, error: "This code is not active." };
    if (p.expires_at && new Date(p.expires_at) < new Date()) return { ok: false as const, error: "This code has expired." };
    if (p.single_use && p.used_at) return { ok: false as const, error: "This code has already been used." };
    return { ok: true as const, pack: { id: p.id, title: p.title, packCode: p.pack_code, categoryTag: p.category_tag } };
  });
