import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalShell } from "./legal.terms";

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Beat the Drop Trivia" },
      { name: "description", content: "What we collect, why, and how long we keep it." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <p className="text-sm text-amber-200/60">Last updated: June 8, 2026</p>

      <p>
        Beat the Drop Trivia is designed to need as little personal information as possible. No
        account, no email, no password — just a nickname and (optionally) a selfie.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Nickname</strong> — the name you type when joining. Shown to other players and the host.</li>
        <li><strong>Selfie (optional)</strong> — if you choose to take one, it's shown next to your score on the TV and leaderboard.</li>
        <li><strong>Room code & gameplay data</strong> — which room you joined, your answers, your score, and your sound choices, so the game can run.</li>
        <li><strong>Twitch handle (optional)</strong> — only if you turn on streamer mode and connect a channel.</li>
        <li><strong>Session ID</strong> — a random identifier stored in your browser's <code>localStorage</code> so you can rejoin a game if you refresh.</li>
      </ul>

      <h2>Selfies — important</h2>
      <ul>
        <li>Selfies are stored in a public-by-URL storage bucket. The URL is hard to guess but it is not access-controlled, so anyone with the link could view the photo.</li>
        <li><strong>We automatically delete every selfie within 24 hours</strong> of when it was uploaded.</li>
        <li>You don't have to take a selfie. You can skip it and still play.</li>
        <li>The camera only turns on after you tap "Allow camera" on the consent screen.</li>
      </ul>

      <h2>How long we keep things</h2>
      <ul>
        <li>Selfies: up to 24 hours.</li>
        <li>Gameplay records (nickname, score, room): kept with the game room so post-game leaderboards work. Old rooms are pruned over time.</li>
        <li>Session ID in your browser: lives until you clear your browser storage.</li>
      </ul>

      <h2>Who we share with</h2>
      <p>
        We use Supabase to host the database and storage, and Cloudflare to serve the app. We
        don't sell your data and we don't run third-party advertising on the Service.
      </p>

      <h2>Children</h2>
      <p>
        The Service isn't directed at children under 13. If you believe a child has submitted
        personal information to us, contact us and we'll delete it.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask us to delete your data at any time — see the{" "}
        <Link to="/legal/contact">contact page</Link>. Depending on where you live you may also
        have rights to access or correct your data under laws like GDPR or CCPA.
      </p>

      <h2>Cookies</h2>
      <p>
        We don't use tracking or advertising cookies. We do use <code>localStorage</code> to
        remember your session ID and your accessibility preferences.
      </p>

      <h2>Changes</h2>
      <p>
        If we make material changes we'll update the date above.
      </p>
    </LegalShell>
  );
}
