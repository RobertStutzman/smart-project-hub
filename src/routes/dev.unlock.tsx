import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { unlockDev } from "@/lib/dev-gate.functions";

export const Route = createFileRoute("/dev/unlock")({
  head: () => ({
    meta: [
      { title: "Unlock" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: UnlockPage,
});

function UnlockPage() {
  const router = useRouter();
  const unlock = useServerFn(unlockDev);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    const password = new FormData(e.currentTarget).get("password") as string;
    try {
      const res = await unlock({ data: { password } });
      if (res.ok) {
        await router.navigate({ to: "/dev" });
        return;
      }
      setError(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-100 px-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900/80 p-6 shadow-xl"
      >
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight">Restricted</h1>
          <p className="text-sm text-neutral-400">
            Enter the password to access the dev playground.
          </p>
        </div>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          placeholder="Password"
          disabled={busy}
        />
        {error && (
          <p className="text-sm text-rose-400">Incorrect password.</p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50"
        >
          {busy ? "Checking…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}
