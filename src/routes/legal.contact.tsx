import { createFileRoute } from "@tanstack/react-router";
import { LegalShell } from "./legal.terms";

export const Route = createFileRoute("/legal/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Beat the Drop Trivia" },
      { name: "description", content: "Get in touch or request data deletion." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <LegalShell title="Contact">
      <p>
        Questions, bug reports, takedowns, or data-deletion requests — send them to:
      </p>
      <p className="text-lg">
        <a href="mailto:hello@droptrivia.app">hello@droptrivia.app</a>
      </p>

      <h2>Data deletion requests</h2>
      <p>
        Email us with the room code and nickname you used (and a rough date/time), and we'll
        delete the associated gameplay record. Selfies are deleted automatically within 24
        hours, so by the time you read this yours is most likely already gone.
      </p>

      <h2>Bug reports</h2>
      <p>
        Tell us what happened, what you expected, and the room code if you have it.
      </p>
    </LegalShell>
  );
}
