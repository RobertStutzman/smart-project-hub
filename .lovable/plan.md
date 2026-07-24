## Move "Custom trivia for your party" off the home page

Remove the amber CTA button from `src/routes/index.tsx` (lines 134-139) and add a discreet "Custom pack" link to `src/components/LegalFooter.tsx` alongside Terms / Privacy / Contact.

Result: home page focuses on Host / Join. Custom ordering still reachable via `/custom` from the footer on every page (and directly by URL). No changes to `/custom` itself.

If you'd rather it live somewhere else (e.g. inside `/join` under the code entry, or on a new `/settings` hub), say the word and I'll swap the destination.