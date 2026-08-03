# Claude Design prompt

Paste this into Claude Design, then use **Send to Claude Code Web** to bring the artifact back.

---

Build a design system for a personal job-search tracker called **Job Search Agent**. A scheduled
agent finds US roles every weekday morning, scores each one 0 to 100 against a fixed rubric, and
the person triages the results here. One user, read every morning on a laptop and sometimes a
phone.

**The feel: editorial, not SaaS.** Warm cream paper, a high-contrast serif for display and for
role titles, a single terracotta accent, hairline rules instead of cards-everywhere, generous
whitespace. It should read like a well-set morning briefing rather than an admin panel. No
purple gradients, no Inter-on-white dashboard look, no drop shadows.

Starting point, all approximate and all worth improving:

- canvas `#FAF8F5`, ink `#1A1A1A`, muted `#6B6B6B`, accent `#C0603C`, accent tint `#F2D9CE`,
  hairline `#E4DFD8`
- display and role titles: high-contrast serif, with the second line of the headline in italic
- labels: small letterspaced uppercase sans, around 10px, `0.14em`
- body and UI: neutral sans
- container about 1120px, main column plus a 300px right rail, 8px radius

Please produce these components, in both a light and a dark variant:

1. **Score badge.** A 40px circle holding a two-digit number. Three states: strong (90 plus,
   accent tint fill, accent numeral), possible (70 to 89), weak (below 70). The tiers must be
   distinguishable without relying on colour alone.
2. **Opportunity row.** Score badge, then a small-caps employer label stacked above a serif role
   title, then a muted evidence line, then a status pill, then a compact `Apply` link, then a
   disclosure chevron. The whole row expands to reveal the rationale, a facts grid, a status
   select, a notes field and secondary actions. Show it closed and open.
3. **Status pills.** new, saved, applied, interviewing, offer, closed. Six visually distinct
   states that stay legible at 10px and do not shout.
4. **Derived stat row.** Four figures with hairline dividers: a large serif number over a small
   uppercase label.
5. **Report header.** A small accent label, a two-line serif headline, a standfirst, and a
   right-hand "best opportunity today" block separated by a vertical hairline.
6. **Right-rail card.** A serif heading over rows of label plus count chip, where each row is a
   clickable filter. Include hover, focus and active states, since these are buttons.
7. **Controls row.** Search input, two selects, and a text `Clear` button, all sharing one height
   and border treatment.
8. **Import dialog.** Heading, explanatory paragraph, monospace textarea, and a result panel that
   can show either a success or an itemised list of rejected rows.
9. **Empty state**, and a **toast**.

Constraints that matter:

- **No `transform: scale()` on anything interactive.** It moves the visual position away from the
  hit target.
- Every interactive element needs a visible focus ring; the rail rows and pills are real buttons,
  not styled divs.
- Must hold together at 390px wide with no horizontal scrolling. Say what collapses first.
- Respect `prefers-reduced-motion`.
- Every value exported as a CSS custom property in a single `:root` block, so the implementation
  can swap one block and nothing else.

Deliver the tokens plus the components as self-contained HTML and CSS with no external
dependencies, no icon font and no framework.
