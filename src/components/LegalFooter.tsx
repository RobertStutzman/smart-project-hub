import { Link } from "@tanstack/react-router";

export function LegalFooter() {
  return (
    <footer className="relative z-10 mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-6 pb-6 text-[11px] uppercase tracking-[0.2em] text-amber-200/40">
      <Link to="/custom" className="hover:text-amber-200/80">Custom Pack</Link>
      <span className="opacity-40">·</span>
      <Link to="/settings/adult" className="text-rose-300/60 hover:text-rose-200">
        🔞 Adult Mode
      </Link>
      <span className="opacity-40">·</span>
      <Link to="/legal/terms" className="hover:text-amber-200/80">Terms</Link>
      <span className="opacity-40">·</span>
      <Link to="/legal/privacy" className="hover:text-amber-200/80">Privacy</Link>
      <span className="opacity-40">·</span>
      <Link to="/legal/contact" className="hover:text-amber-200/80">Contact</Link>
    </footer>
  );
}
