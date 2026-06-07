I’ll update the host lobby so Silk browser chrome and TV overscan can’t hide the join QR.

Plan:
1. Move the join block into a dedicated top-right TV-safe panel
   - Keep the QR code and room code always visible near the top-right.
   - Add enough inset padding so TV overscan does not crop it.
   - Keep it visible even when the rest of the lobby content changes.

2. Rebalance the lobby layout around the fixed join panel
   - Reduce the room-code/QR footprint in the main left column so the page is no longer dependent on bottom space.
   - Keep player list, categories, and host controls readable without requiring scroll.
   - Avoid using vertical space that Silk’s address/navigation bars may steal.

3. Add Silk/TV-safe sizing rules
   - Use viewport-height-safe clamps instead of large desktop sizes.
   - Prefer smaller QR sizing for 720p TV browsers.
   - Add safe margins around the whole lobby for TVs that crop edges.

4. Verify the target behavior
   - Check the host lobby at a 1280×720 viewport.
   - Confirm the QR code is fully visible without scrolling.
   - Confirm the room code remains readable and host controls are still usable.