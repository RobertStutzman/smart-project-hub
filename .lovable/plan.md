## Swap cursive nudge label for on-brand typography

In `src/routes/host.tsx` `cat-nudge` `<span>`:
- Remove inline `fontFamily: "'Caveat', 'Comic Sans MS', cursive"` and the `fontSize: "1.05rem"` override.
- Apply the same lobby-chrome treatment: `text-[11px] font-bold uppercase tracking-[0.25em] text-amber-200`.
- Keep copy: `psst — you can pick your categories!`

Arrow shape, position, animation, and dismiss logic unchanged.