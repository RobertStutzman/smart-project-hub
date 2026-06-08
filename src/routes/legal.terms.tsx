import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function LegalShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main
      className="relative min-h-screen text-amber-50"
      style={{
        background:
          "radial-gradient(ellipse 90% 60% at 50% 0%, oklch(0.22 0.04 270 / 0.95), oklch(0.06 0.02 270) 70%)",
      }}
    >
      <div className="relative mx-auto max-w-2xl px-6 py-12">
        <Link to="/" className="text-sm text-amber-200/70 hover:text-amber-100">← Home</Link>
        <h1 className="mt-6 font-display text-4xl font-black tracking-tight">
          <span className="bg-gradient-to-b from-amber-200 via-amber-300 to-amber-500 bg-clip-text text-transparent">
            {title}
          </span>
        </h1>
        <div className="prose prose-invert mt-8 max-w-none text-amber-100/85 [&_a]:text-amber-300 [&_h2]:font-display [&_h2]:text-amber-200 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_p]:mt-3 [&_p]:leading-relaxed [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mt-1">
          {children}
        </div>
        <div className="mt-12 flex gap-4 text-xs uppercase tracking-[0.2em] text-amber-200/50">
          <Link to="/legal/terms" className="hover:text-amber-200">Terms</Link>
          <Link to="/legal/privacy" className="hover:text-amber-200">Privacy</Link>
          <Link to="/legal/contact" className="hover:text-amber-200">Contact</Link>
        </div>
      </div>
    </main>
  );
}

export const Route = createFileRoute("/legal/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Beat the Drop Trivia" },
      { name: "description", content: "The rules for using Beat the Drop Trivia." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalShell title="Terms of Service">
      <p className="text-sm text-amber-200/60">Last updated: June 8, 2026</p>

      <p>
        Welcome to Beat the Drop Trivia ("the Service"). By accessing or using the Service you
        agree to these Terms. If you don't agree, please don't use the Service.
      </p>

      <h2>1. The Service</h2>
      <p>
        Beat the Drop Trivia is a live multiplayer trivia game. A host runs a game room on one
        screen and players join from their phones using a short room code.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        The Service is intended for a general audience. If you are under the age of majority in
        your jurisdiction, you may only use the Service with the involvement of a parent or
        guardian.
      </p>

      <h2>3. Acceptable use</h2>
      <ul>
        <li>Don't pick nicknames or upload selfies that are harassing, hateful, sexual, or unlawful.</li>
        <li>Don't try to disrupt games, cheat, scrape, or attack the Service.</li>
        <li>Don't impersonate other people or pretend to be a host you aren't.</li>
      </ul>
      <p>
        We can remove content, kick players, or block access at any time at our discretion.
      </p>

      <h2>4. User content</h2>
      <p>
        You keep ownership of the nickname and selfie you submit. You grant us a limited license
        to display them inside the game session and on the leaderboard while the game is being
        played. Selfies are deleted automatically within 24 hours (see the Privacy Policy).
      </p>

      <h2>5. No warranty</h2>
      <p>
        The Service is provided "as is" without warranties of any kind. We don't guarantee it
        will be uninterrupted, error-free, or available at any particular time.
      </p>

      <h2>6. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, we are not liable for any indirect, incidental,
        or consequential damages arising from your use of the Service.
      </p>

      <h2>7. Changes</h2>
      <p>
        We may update these Terms. If we make material changes we'll update the date above.
        Continued use of the Service means you accept the new Terms.
      </p>

      <h2>8. Contact</h2>
      <p>
        Questions? See the <Link to="/legal/contact">contact page</Link>.
      </p>
    </LegalShell>
  );
}
