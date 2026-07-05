---
name: feiyu-design
description: Use this skill to generate well-branded interfaces for Feiyu. Contains colors, type, fonts, assets, and UI kit for prototyping dashboard UIs.
user-invocable: true
---
# Feiyu Design Skill

Read the `README.md` file within this skill, and explore the other available files.

If creating visual artifacts, copy assets out and create static HTML files. If working on production code, read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build
or design, ask some questions, and act as an expert designer who outputs HTML artifacts
_or_ production code, depending on the need.

## Quick map
- `README.md` — brand context, content fundamentals, visual foundations (read first)
- `css.json` — structured token understanding source
- `colors_and_type.css` — drop-in runtime CSS variables; link it, do not read it to understand tokens when css.json exists
- `components.css` — aggregated component CSS
- `components/index.json` — component index + cross-component patterns
- `preview/` — small HTML cards illustrating foundations and components
- `library-consumption.json` — recommended downstream read order
- `uikit-plan.json` — component whitelist and UIKit planner output
- `ui_kits/dashboard/` — full click-thru recreation

Component sources are consumed in priority order: `preview/component-{slug}.html` first, `components/{slug}.json` for intent/variants, and fallback evidence if available.

## Essentials at a glance
- Brand primary `#1456F0` — cool, professional blue. No warm accents; the palette is restrained and technically neutral.
- Radius 4/6/8/12/9999 — moderate and deliberate. Pill (`9999px`) reserved only for avatar circles and tags.
- 36px default control height, 4px base spacing unit, 8-pt grid. Inputs 36px, buttons 32/36/40px.
- Type: Inter (display + headings, loaded via Google Fonts), PingFang SC (CN body), Menlo/Consolas (code). System fallback: -apple-system, BlinkMacSystemFont, Segoe UI, Microsoft YaHei.
- Voice: bilingual CN-first, professional, neutral, clean. No emoji in product UI.
- Shadows whisper-quiet: 5 levels from `0 1px 2px` (tooltip) to `0 12px 24px` (modal), all rgba(31,35,41). Background hierarchy via surface tones, not shadows.
- IM-first layout: three-column pattern (54px icon rail + 280px conversation list + content area), blue self-bubbles (`#1456F0`) vs gray other-bubbles (`#f8f9fa`).
- Dark mode fully inverted: surface base `#1f2329`, text `#2e3236`, primary shifts to `#4a82f3`.

## Components
| Slug | Name | Key Insight |
|------|------|-------------|
| button | Button | Compact height, blue primary fill, 6px radius on md/lg, 4px on sm |
| input | Input | 36px height, light `#d0d3d6` border, blue focus ring with 0.15 opacity glow |
| chat-bubble | ChatBubble | Self blue vs other gray, 8px radius, max-width 240px, with sender avatar |
| avatar | Avatar | Circular crop, online status dot (green), four sizes: 24/36/48/64px |
| card | Card | Light border on `#f8f9fa` surface, 8px radius, shadow-2 elevation, hover brightness dip |
| sidebar-nav | SidebarNav | Three-column IM: 54px icon rail + 280px conv list + content, active accent highlight |
