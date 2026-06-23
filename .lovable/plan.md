
# Custom Party Question Packs — MVP

A new revenue stream: customers (bachelorette/wedding/birthday hosts) submit info about the guest of honor, you write custom questions in an admin tool, and they get a private room code that loads ONLY their pack.

## User-facing flow

1. **Marketing page** at `/custom` — explains the offering ("Custom trivia for your wedding/party"), price, examples, CTA to order.
2. **Intake form** at `/custom/order` — public, no login required:
   - Customer name + email
   - Event type (wedding, bachelorette, birthday, roast, other)
   - Event date
   - Guest of honor name(s)
   - Long-form text fields: childhood, embarrassing stories, inside jokes, hobbies, exes/dirt, anything else
   - Tone slider (clean → spicy/roast)
   - Desired # of questions (10/20/30)
   - Submits → confirmation page with order ID
3. **Email confirmation** to customer ("we got your order, expect code within 48h").
4. **You fulfill in admin** (see below) → on approval, a unique room code is generated and emailed to the customer.
5. **Host plays**: on `/host`, enters their custom code. Game loads only that pack, skipping normal category picker.

## Admin queue (you)

New tab in `/admin` → "Custom Packs":
- List of orders with status (new / drafting / ready / delivered).
- Click an order → see all intake answers + a question editor.
- **AI draft button**: sends intake info to Lovable AI (Gemini) with a prompt template that produces N multiple-choice questions matching the requested tone. Returns drafts you can edit inline (question, 4 answers, correct index, explanation).
- Edit / add / delete questions freely.
- **Approve & deliver**: generates a unique 6-char code, marks pack `ready`, emails customer the code + simple "how to play" instructions.

## Code behavior in-game

- Custom codes are distinct from the random 4-letter room codes (6 chars, prefix or longer length so they don't collide).
- When a host enters a custom code on `/host`:
  - Skip category selection and difficulty picker.
  - Create a room seeded with the custom pack's questions in the order/shuffle you chose.
  - Show event branding on the lobby ("Sarah & Mike's Wedding Trivia").
- Pack is reusable until an expiry date (default: event date + 7 days) or single-use — toggle per order.

## Out of scope for MVP (deferred)

- Stripe payments (manual invoice for now; payments added in a follow-up).
- Self-serve AI generation without your review.
- Customer accounts / order history portal.

## Technical sketch

### New tables (migration)

```text
custom_orders
  id, created_at, status, customer_name, customer_email,
  event_type, event_date, honoree_names, intake_payload (jsonb),
  tone, question_count, notes, delivered_at, expires_at, single_use

custom_packs
  id, order_id (fk), pack_code (unique 6-char), title,
  is_active, used_at (nullable for single_use), expires_at

custom_pack_questions
  id, pack_id (fk), position, prompt, choices (jsonb 4),
  correct_index, explanation, difficulty
```

All public schema → GRANT to `authenticated` + `service_role`; `anon` only gets SELECT on `custom_packs` by `pack_code` (for code lookup at room start). RLS enforces admin-only writes via `has_role(auth.uid(), 'admin')`.

### Server functions (`src/lib/custom-packs.functions.ts`)

- `submitCustomOrder` — public, validates intake, inserts `custom_orders`, sends ack email.
- `listCustomOrders` — admin only.
- `getCustomOrder(id)` — admin only.
- `draftQuestionsWithAI(orderId)` — admin only; calls Lovable AI Gateway (`google/gemini-3-flash-preview`) with intake context + tone, returns N questions, persists as drafts on the pack.
- `upsertPackQuestion`, `deletePackQuestion`, `reorderPackQuestions` — admin only.
- `approveAndDeliverPack(orderId)` — admin only; generates unique `pack_code`, marks ready, sends delivery email with code.
- `lookupPackByCode(code)` — public; returns pack metadata if active + unexpired.

### Game integration

- Extend `createRoom` / a new `createCustomRoom(packCode)` to seed `room_questions` from `custom_pack_questions` instead of category sampling.
- `/host` lobby: add a "Have a custom code?" field next to the normal start. On submit → `createCustomRoom` → straight to lobby skip category step.
- Mark room with `custom_pack_id` so leaderboard/explanations work normally.

### Admin UI

- New route `src/routes/_authenticated/admin-custom.tsx` (admin role gated via `has_role`).
- List + detail view, AI-draft button, inline question editor (reuse styles from existing `admin-questions.tsx`).

### Email

- Use existing email infra if present; otherwise add Resend connector. Two templates: order received, code delivered.
- Confirm with you before adding a new connector.

### Marketing page

- `/custom` route with simple sales copy, sample questions, FAQ, CTA → `/custom/order`.
- SEO metadata (title, description, og) in route `head()`.

## Open questions (will confirm before building)

1. Price point / shown on `/custom` page? (Or hide price, "starts at $X"?)
2. Email sending — do you already have Resend/SendGrid connected, or should we add Resend?
3. Honoree photo upload in intake form (could be used on lobby splash)?
