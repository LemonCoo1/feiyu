# Feiyu Design System

A design system for **Feiyu** — a SaaS dashboard product with IM-collaboration patterns. The system is purpose-built for internal tools, team messaging, and data-dense admin interfaces with a clean, professional aesthetic.

## Source

- **Route:** from-scratch (no upstream Figma library)
- **Brand owner:** Feiyu
- **Kit type:** dashboard

## What this design system covers

- **Foundations** — color scales (primary, success, warning, danger, info, text, surface), Inter + PingFang SC type stack, 4px spacing base, 5-level shadow system, 4–12px radius
- **Components** — 6 documented components: Button, Input, ChatBubble, Avatar, Card, SidebarNav
- **Preview cards** — per-component HTML previews for visual reference

---

## CONTENT FUNDAMENTALS

### Voice & tone

The brand communicates in Chinese (CN-first) with a professional, restrained tone. UI copy is functional and direct — no decorative language, no emoji in product surfaces. The voice mirrors enterprise SaaS norms: concise instructional text, neutral status descriptions, and action labels that prioritize clarity over personality. Formality sits at "collegial professional" — not stiff, but never casual. Bilingual context exists (Latin + CJK), but Chinese drives the interaction semantics.

### Concrete copy examples (from component contracts)

- Button CTA context: action labels like send, confirm, cancel — functional, never decorative
- ChatBubble context: message content separated into "self" (sender) and "other" (received) visual channels
- SidebarNav context: three-column IM layout with icon rail and conversation list navigation labels

### When generating copy

- Keep labels action-oriented and under 4 Chinese characters where possible
- Status and helper text should be descriptive-neutral, never alarmist
- Avoid emoji in any product UI surface; reserve decorative marks for marketing contexts only

---

## VISUAL FOUNDATIONS

### Color

The palette is anchored by a cool, saturated blue primary at `#1456f0` (feiyu-primary-500). This is not a default Tailwind blue — it sits between indigo and royal, conveying technical competence without warmth. The primary scale runs 10 stops from `#e8f0fe` (50) through `#051f6b` (900), providing enough depth for container backgrounds, hover states, and disabled variants without ever reaching purple.

Success (`#22b567`), warning (`#f5a623`), danger (`#f53f3f`), and info (`#3b87e6`) each carry their own 10-stop scale. A notable decision: info is intentionally distinct from primary — info sits at `#3b87e6` (lighter, softer) versus primary's `#1456f0`, which prevents confusion in status-heavy dashboard layouts where both "action" blue and "informational" blue coexist.

The neutral system is split into two parallel scales. Text neutral runs from `#f5f6f7` (50, near-white) down to `#1f2329` (900, near-black). Surface neutral mirrors this range but with its own primary stop at `#d0d3d6` (500) — the dominant border and divider color. The working background is `#ffffff` (surface-50), with cards landing on `#f8f9fa` (surface-100) and subtle elevation stepping through `#f5f6f7` and `#eff0f1`. The overall vibe is cool-grey precision: clinical but not cold, with blue as the sole warm accent thread.

The dark mode inverts the palette: primary flips to `#4a82f3` at the 500 stop, backgrounds drop to `#1f2329`, and foreground text lightens to `#2e3236` for softer contrast on dark surfaces.

### Typography

The display and heading face is **Inter**, loaded via Google Fonts with weights 400/500/600/700. Inter handles Latin characters, numerals, and CJK fallthrough. The body face is **PingFang SC** for CJK-dominant contexts (macOS/iOS), falling back through `-apple-system, BlinkMacSystemFont, Segoe UI, Microsoft YaHei` for Windows. Mono contexts use **Menlo** / **Consolas**.

The type scale is compact and dashboard-appropriate: display at 32px/1.2 (weight 700), h1 at 28px/1.25, h2 at 24px/1.3, h3 at 20px/1.35, h4 at 16px/1.4, body at 14px/1.5 (weight 400), lead at 16px/1.6, caption at 12px/1.5, eyebrow at 11px/1.4 with 0.08em tracking and uppercase transform. The display class applies -0.02em letter-spacing for tighter large-type setting. Line heights tighten progressively as size increases, which is the right pattern for data-dense UIs where vertical space is at a premium.

### Spacing

Spacing is built on a 4px base unit, with 8 named tokens: 4, 8, 12, 16, 24, 32, 48, 64px. The system follows a semi-modular scale that skips 20px and 40px, jumping from 16 to 24 and from 32 to 48. Default input height is 36px; buttons come in three heights (32px sm, 36px md, 40px lg). The sidebar is fixed at 240px with a 48px nav bar — standard dashboard dimensions that keep the content area generous.

### Radius

Four explicit radius tokens plus a pill value. The workhorse is `--feiyu-radius-sm` at 4px, used for compact controls, small chips, and ghost buttons. `--feiyu-radius-md` at 6px handles standard interactive elements like primary buttons and inputs. `--feiyu-radius-lg` at 8px applies to cards and containers. `--feiyu-radius-xl` at 12px is reserved for larger surface treatments. The pill value (9999px) exists for avatar crops and status indicators. The philosophy is "deliberately restrained" — nothing softer than 12px, no large-radius cards or modal wrappers.

### Shadow / Elevation

Five shadow levels, all using the same base color `rgba(31,35,41, ...)` at increasing opacity. Level 1 (Tooltip): `0 1px 2px` at 6% — barely-there, for small floating elements. Level 2 (Card): `0 2px 4px` at 8% — the resting card elevation. Level 3 (Card Hover): `0 4px 8px` at 10% — interactive lift on hover. Level 4 (Float): `0 8px 16px` at 12% — for dropdowns and popovers. Level 5 (Modal): `0 12px 24px` at 16% — the strongest level, for modal overlays. The shadows are whisper-quiet at rest and escalate gently, never reaching the heavy, colored shadow territory seen in consumer products.

### Borders

The standard border token maps to `#d0d3d6` (surface-500) — a light-cool grey that reads as structural without competing with content. Border width is consistently 1px. The system does not use colored borders for semantic states; instead, it relies on background fills and text color shifts.

### Animation

No explicit animation tokens are defined in the CSS. Transitions, if present in components, are inferred from preview behavior. This is a caveat — see the substitutions section below.

### Iconography

Three icon sizes are defined: 16px (sm), 20px (md), 24px (lg). Icons are expected to be inline SVGs with currentColor inheritance. No icon font or external icon library is bundled.

---

## Component Patterns

| Component | Preview | Contract | CSS Source | Key Facts | Key Insight |
|---|---|---|---|---|---|
| Button | `preview/component-button.html` | `components/button.json` | `components.css` | 4 variants (primary/secondary/ghost/text), 3 sizes (sm/md/lg), 36px default height | Compact, blue-primary, 6px radius — enterprise CTA, not consumer |
| Input | `preview/component-input.html` | `components/input.json` | `components.css` | 36px height, 6px radius, blue focus ring | Light border at rest, blue ring on focus — standard dashboard form pattern |
| ChatBubble | `preview/component-chat-bubble.html` | `components/chat-bubble.json` | `components.css` | 3 variants (self/other/system), sender avatar, rounded corners | Self messages use primary blue background; others use surface grey |
| Avatar | `preview/component-avatar.html` | `components/avatar.json` | `components.css` | 4 variants, circular crop, online status indicator, multi-size | Online dot indicator is a signature IM pattern |
| Card | `preview/component-card.html` | `components/card.json` | `components.css` | 3 variants, surface-100 background, shadow-2 at rest | Light border or no border; surface fill + subtle shadow defines containment |
| SidebarNav | `preview/component-sidebar-nav.html` | `components/sidebar-nav.json` | `components.css` | 2 variants, 240px width, three-column IM layout | Icon rail + conversation list mirrors Feishu's navigation architecture |

---

## Index

- `README.md` — this file
- `colors_and_type.css` — CSS custom properties for color, type, radius, shadow, spacing; link in production, do not read for token semantics when `css.json` exists
- `components.css` — aggregated component styles extracted from preview pages
- `css.json` — structured JSON token representation for programmatic consumption
- `components/index.json` — component index with cross-component patterns
- `components/{slug}.json` — per-component compact contract (intent/variants)
- `preview/` — small HTML cards illustrating each component
- `SKILL.md` — agent skill manifest with quick-reference essentials

---

## Caveats / known substitutions

1. **Inter** is loaded via Google Fonts CDN (`fonts.googleapis.com`). For offline or air-gapped environments, Inter must be self-hosted. PingFang SC is macOS/iOS only — Windows users fall back to Microsoft YaHei via the declared stack. This means CJK rendering will differ between platforms; expect slightly different metrics and weight availability (YaHei has fewer weight variants than PingFang SC).

2. **BrandFile (phase2-brand-analyst.json)** is empty — no upstream brand brief, designer quotes, or UI copy samples were provided. All content fundamentals and copy examples are inferred from component contracts and CSS structure rather than extracted from a Figma library or brand guidelines document. Treat the Voice & tone section as directional, not authoritative.

3. **Animation tokens are absent** from `colors_and_type.css`. Component previews may contain implicit transitions (e.g., hover state shifts), but no `--transition-*` or `--duration-*` tokens are formalized. If motion design is needed downstream, these tokens should be added to the CSS before building interactive prototypes.

4. **`@group-priority` was demoted** for primary/success/warning/info semantic groups due to alias separation in the CSS generation pipeline. The short aliases (`--color-success`, `--color-warning`, etc.) resolve to the 600-stop of each semantic scale rather than the 500-stop. This is intentional but may surprise consumers expecting `@primary` to map to scale 500.

5. **All components are `from-scratch`** with `confidence: medium`**.** No Figma evidence exists — component anatomy, variants, and states are synthesized from dashboard UI conventions rather than extracted from a production design file. Treat `doNotInvent` lists as boundaries, not guarantees of non-existence.
