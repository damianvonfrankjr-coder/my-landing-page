# Design — Prime Reserve Planning

A locked design system for this site. Every page redesign reads this file before
emitting code. Do not regenerate per page — extend or amend this file when the
system needs to grow.

## Genre

modern-minimal

## Macrostructure family

- Marketing pages (index, about-us, our-leadership-team, reserve-studies,
  in-house-reserve-studies, consulting-services, properties-we-serve,
  international): **Split Studio** — diptych rows, text one side / proof the
  other, alternating direction. Hero archetype may vary (H2 split diptych is
  the default).
- Content pages: **Conversational FAQ** (faqs) · **Index-First**
  (service-areas) · **Catalogue** (samples).
- Utility pages (contact-us, request-for-proposal): single-column form
  layout, typography only, F4 step sequence allowed for process context.

## Theme

Custom (tuned) — anchored on the brand blue carried over from the previous
site. Vibe: "credentialed, fiscal, engineered calm."

- `--color-paper`      oklch(97.5% 0.006 240)
- `--color-paper-2`    oklch(95% 0.008 240)
- `--color-ink`        oklch(21% 0.015 245)
- `--color-ink-2`      oklch(34% 0.015 245)
- `--color-rule`       oklch(84% 0.010 240)
- `--color-rule-2`     oklch(89% 0.008 240)
- `--color-muted`      oklch(44% 0.015 245)
- `--color-accent`     oklch(50% 0.135 245)
- `--color-accent-ink` oklch(97.5% 0.006 240)
- `--color-focus`      oklch(48% 0.19 245)
- `--color-error`      oklch(50% 0.19 25)

Axes: **light / roman-serif / cool**.

## Typography

- Display: Source Serif 4, weight 600, style normal (never italic headers)
- Body: Geist, weight 400
- Mono (outlier): Geist Mono, weight 400 — data role only: stat figures and
  spec-table numerals. Two slots max.
- Display tracking: -0.02em
- Type scale anchor: `--text-display: clamp(2.5rem, 4.5vw + 0.75rem, 4.5rem)`
- Scale ratio 1.25 (major third)

## Spacing

4-point named scale. The values are in `css/tokens.css`. Pages must use named
tokens (`var(--space-md)`), never raw values.

## Motion

- Easings: `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)` ·
  `--ease-in: cubic-bezier(0.7, 0, 0.84, 0)` ·
  `--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1)`
- Reveal pattern: none — the page is composed. No scroll reveals.
- Three motion primitives, site-wide ceiling: (1) CTA hover lift,
  (2) FAQ accordion expand (`grid-template-rows: 0fr → 1fr`),
  (3) nav frost-on-scroll.
- Reduced-motion fallback: opacity-only, ≤ 150 ms.

## Microinteractions stance

- Silent success; celebratory toasts: never.
- Hover tooltip delay 800 ms · focus delay 0 ms.
- Focus rings appear instantly, 2 px, `--color-focus`, offset 2 px.
- Form validation on blur (touched pattern), error text replaces helper text.

## CTA voice

- Primary CTA: accent fill, `--color-accent-ink` text, 6 px radius,
  copy pattern "Request a proposal".
- Secondary CTA: C1 outlined chip, 1 px ink border, transparent fill,
  typographic verb + arrow ("View sample reports →").

## Per-page allowances

- Marketing pages MAY use hand-built SVG only (Tier B ceiling). Current
  build: enrichment none — typography carries every page.
- Content pages: typography only.
- Utility pages: typography only.

## What pages MUST share

- The wordmark: "Prime Reserve Planning" in Source Serif 4 600.
- The accent colour and its placement (≤ 5% per viewport).
- The display + body fonts.
- The CTA voice (button shape, 6 px radius, padding rhythm).
- Nav N1b (three-section: wordmark · centre links with dropdowns ·
  contact + filled CTA) and footer Ft1 (mast-headed).
- The tagline: "Securing tomorrow, today."

## What pages MAY differ on

- Macrostructure within the page-type family.
- Hero archetype (H2 default; H4 stat-led allowed on data-heavy pages).
- Diptych row count and direction rhythm.

## Content rules

- Honest copy only. Every stat, price, credential number, and testimonial on
  these pages is taken from the client's own published content. Do not invent
  metrics (slop-test gate 46).
- Real facts in use: 300+ clients in three years · RS credentials #369, #503,
  #504 · $400 in-house engagement · ~$200/hour consulting · $2,500–$5,500
  typical full-study range · 4–6 week turnaround · 60-day revision period ·
  five-business-day in-house delivery.
- Forms have no backend on a static host. Submit handlers compose a
  pre-filled email (mailto:) and say so in the UI. Swap in a form service or
  Cloudflare Pages Function when ready.

## Exports

### tokens.css

See `css/tokens.css` — the canonical token file for this site.

### Tailwind v4 `@theme`

```css
@theme {
  --color-paper:  oklch(97.5% 0.006 240);
  --color-ink:    oklch(21% 0.015 245);
  --color-accent: oklch(50% 0.135 245);
  --font-display: "Source Serif 4", Georgia, serif;
  --font-body:    "Geist", system-ui, sans-serif;
  --spacing-md:   1rem;
  --text-md:      1.25rem;
  --ease-out:     cubic-bezier(0.16, 1, 0.3, 1);
}
```

### DTCG `tokens.json`

```json
{
  "color": {
    "paper":  { "$value": "oklch(97.5% 0.006 240)", "$type": "color" },
    "ink":    { "$value": "oklch(21% 0.015 245)", "$type": "color" },
    "accent": { "$value": "oklch(50% 0.135 245)", "$type": "color" }
  },
  "font": {
    "display": { "$value": "Source Serif 4", "$type": "fontFamily" },
    "body":    { "$value": "Geist", "$type": "fontFamily" }
  },
  "space": {
    "md": { "$value": "1rem", "$type": "dimension" }
  }
}
```

### shadcn/ui CSS variables

```css
:root {
  --background:         97.5% 0.006 240;
  --foreground:         21% 0.015 245;
  --primary:            50% 0.135 245;
  --primary-foreground: 97.5% 0.006 240;
  --muted:              84% 0.010 240;
  --muted-foreground:   44% 0.015 245;
  --border:             84% 0.010 240;
  --input:              84% 0.010 240;
  --ring:               48% 0.19 245;
  --radius:             6px;
}
```
