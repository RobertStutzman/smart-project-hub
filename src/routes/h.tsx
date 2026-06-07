import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/h")({
  beforeLoad: () => {
    throw redirect({ to: "/host" });
  },
});
