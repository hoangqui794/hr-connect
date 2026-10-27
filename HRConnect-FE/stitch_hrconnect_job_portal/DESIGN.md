---
name: HRConnect Modern Enterprise & Talent Platform
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#3e4943'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#6e7a73'
  outline-variant: '#bdc9c2'
  surface-tint: '#006c4f'
  primary: '#005f45'
  on-primary: '#ffffff'
  primary-container: '#007a5a'
  on-primary-container: '#a4ffd8'
  inverse-primary: '#79d9b2'
  secondary: '#1d59c1'
  on-secondary: '#ffffff'
  secondary-container: '#6292fd'
  on-secondary-container: '#002b6b'
  tertiary: '#982e00'
  on-tertiary: '#ffffff'
  tertiary-container: '#c03e05'
  on-tertiary-container: '#ffe8e1'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#95f5ce'
  primary-fixed-dim: '#79d9b2'
  on-primary-fixed: '#002116'
  on-primary-fixed-variant: '#00513b'
  secondary-fixed: '#d9e2ff'
  secondary-fixed-dim: '#b0c6ff'
  on-secondary-fixed: '#001945'
  on-secondary-fixed-variant: '#00419c'
  tertiary-fixed: '#ffdbd0'
  tertiary-fixed-dim: '#ffb59d'
  on-tertiary-fixed: '#390c00'
  on-tertiary-fixed-variant: '#832600'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '800'
    lineHeight: 44px
    letterSpacing: -0.015em
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.015em
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-sm: 1rem
  margin: 2rem
  margin-sm: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style
The design system positions recruitment as a catalyst for professional momentum, security, and human advancement. Designed for both high-ambition job seekers and enterprise hiring teams in the Vietnamese market, the aesthetic merges corporate rigor with warm, approachable optimism. 

The aesthetic is Modern Corporate with Humanist Editorial inflections. It avoids clinical coldness by utilizing balanced whitespace, clear micro-typographic hierarchy, structured card surfaces, and tactile accents. Visual signals inspire trust through deep maritime-infused teal foundations while injecting ambition through bright amber-coral focal elements, establishing clarity across complex resume flows, salary negotiations, and high-volume applicant pipelines.

## Colors
The color architecture relies on high-contrast role-based tokens calibrated for daytime search and heavy data density:

- **Primary (`#007A5A` - Deep Emerald Teal):** Signifies financial prosperity, stability, and career development. Governs dominant navigation, active states, key application workflows, and verified company credentials.
- **Secondary (`#0F52BA` - Sapphire Blue):** Reinforces institutional authority, corporate compliance, and technological precision. Applied to analytics graphs, candidate assessment indicators, and enterprise portal switchers.
- **Tertiary (`#FF6B35` - Energetic Coral Amber):** Drives behavioral momentum. Reserved for immediate conversion points: primary "Apply Now" triggers, hot-job tags, salary ranges (e.g., VND millions/USD quotes), urgency banners, and premium listing outlines.
- **Neutral (`#0F172A` - Slate Charcoal):** Foundational ink tone. Off-whites and light slate surfaces (`#F8FAFC`, `#F1F5F9`) prevent retinal fatigue during prolonged resume evaluations, while crisp borders (`#E2E8F0`) maintain compartmental rigor.

Semantic states:
- **Success:** `#059669` (Application sent, interview confirmed)
- **Warning:** `#D97706` (Expiring post, missing CV fields)
- **Error:** `#DC2626` (Invalid file format, rejection notification)
- **Info:** `#2563EB` (Tips, platform updates)

## Typography
Plus Jakarta Sans is specified across all levels for its tall x-height, open apertures, and balanced Vietnamese diacritic positioning (crucial for complex tone marks such as dấu hỏi, ngã, and nặng). 

- **Display & Headlines:** Used for market insights, hero conversion titles, and company profiles. Slightly condensed tracking delivers an authoritative editorial tone without sacrificing scannability.
- **Body:** Standardized at 14px (`body-md`) and 16px (`body-lg`) with generous line-heights to support lengthy job descriptions, requirement checklists, and CV previews.
- **Labels & Microcopy:** Badges, salary markers, and experience chips employ `label-sm` and `label-md` with semi-bold to bold weights, maintaining legibility even when rendered inside tinted container tags.

## Layout & Spacing
The layout follows a disciplined 12-column responsive fluid grid designed to balance wide data tables for employers with centered, focused reading columns for applicants.

- **Breakpoints:**
  - **Desktop (≥ 1280px):** 12 columns, 1200px max-width container, `gutter`: 24px (`1.5rem`), outer `margin`: 32px (`2rem`).
  - **Tablet (768px – 1279px):** 8 columns, full-width container with `gutter`: 16px (`1rem`), outer `margin`: 24px (`1.5rem`).
  - **Mobile (< 768px):** 4 columns, fluid container with `gutter-sm`: 16px (`1rem`), outer `margin-sm`: 16px (`1rem`).

- **Vertical Rhythm:** 
  The base unit is 4px. Structural sections separate by `space-xl` (40px) or double increments (80px), while intra-card elements leverage `space-xs` (4px) to `space-md` (16px) to keep job cards compact and information-dense without visual friction.

## Elevation & Depth
Elevation emphasizes clarity, crispness, and utility rather than heavy ornamental layering:

- **Surface System:**
  - **Base Canvas:** `#F8FAFC` provides a soft, low-glare backdrop.
  - **Surface Container (Cards & Panels):** Pure `#FFFFFF` resting on the canvas, bounded by a 1px solid stroke (`#E2E8F0`).
  - **Surface Lifted (Dropdowns, Popovers, Modals):** Pure `#FFFFFF` elevated above content using focused ambient shadows.

- **Shadow Scales:**
  - **Level 1 (Subtle Cards & Filters):** `0px 1px 3px rgba(15, 23, 42, 0.05), 0px 1px 2px rgba(15, 23, 42, 0.03)`
  - **Level 2 (Hovered Job Cards, Menus):** `0px 4px 12px -2px rgba(15, 23, 42, 0.08), 0px 2px 4px -1px rgba(15, 23, 42, 0.04)`
  - **Level 3 (Sticky Headers, Floating Action CTA):** `0px 12px 24px -4px rgba(15, 23, 42, 0.10), 0px 4px 8px -2px rgba(15, 23, 42, 0.04)`
  - **Level 4 (Modals, Application Drawers):** `0px 24px 48px -12px rgba(15, 23, 42, 0.18)`

Hovering an actionable job card initiates a subtle upward translation (`-2px`) combined with an elevation transition from Level 1 to Level 2 and an emerald border highlight (`#007A5A` at 40% opacity).

## Shapes
A roundedness factor of `2` (0.5rem / 8px base) grounds the system in contemporary software norms, balancing human-centered friendliness with enterprise precision.

- **Inputs, Buttons, Cards:** 8px (`0.5rem`) radius creates sturdy, uniform components that tile comfortably.
- **Large Panels & Dialogs (`rounded-lg`):** 16px (`1rem`) softens viewport takeovers and major profile widgets.
- **Filter Tags & Status Chips:** 9999px (full pill) shapes distinguish metadata tags from actionable rectangular buttons.
- **Company Logos:** Fixed 12px squircle containers with light inset borders to cleanly encapsulate partner logos of varying aspect ratios.

## Components

- **Buttons:**
  - *Primary Conversion:* High-energy Coral (`#FF6B35`) with bold white text for "Nộp đơn ngay" (Apply Now) and checkout triggers. Hover shifts to `#EA580C`.
  - *Primary Core:* Deep Emerald (`#007A5A`) with white text for search submission, account creation, and primary dashboard actions. Hover shifts to `#006349`.
  - *Secondary:* Pure white background, 1px `#E2E8F0` border, text `#0F172A`. Hover transitions to `#F1F5F9`.
  - *Tertiary / Ghost:* Transparent background with `#007A5A` text, used for in-line table interactions and secondary job actions.

- **Chips & Status Badges:**
  - *Salary Highlight:* Pale emerald fill (`#ECFDF5`), deep emerald text (`#065F46`), font `label-md`.
  - *Urgent / Hot Job:* Soft coral fill (`#FFF7ED`), coral amber text (`#C2410C`), accompanied by an urgent dot icon.
  - *Skill / Attribute Chip:* Slate tint (`#F1F5F9`), slate text (`#475569`), pill-shaped with 4px vertical padding and 10px horizontal padding.

- **Job Listing Cards:**
  - Standardized white surface on light slate canvas. Layout structure: Company avatar on top-left, job title with hover state on main header, company name in muted slate, key attributes (Salary, Location, Seniority) rendered as chip clusters, and a subtle bookmark toggle on the top-right.

- **Inputs & Search Filters:**
  - Search bars pair input fields with integrated category and province dropdowns (e.g., "Tất cả địa điểm / Toàn quốc", "Hà Nội", "TP. Hồ Chí Minh").
  - Inputs feature 44px minimum touch targets, 1px `#CBD5E1` borders, and an active ring state using `#007A5A` with a 3px diffused outer halo (`rgba(0, 122, 90, 0.15)`).

- **Lists & Data Tables:**
  - Alternate row striping on applicant tracking views. Cell padding fixed at 12px vertical and 16px horizontal. Sticky headers with subtle bottom border separation (`#E2E8F0`).

- **Domain-Specific: CV Score & Match Index:**
  - Compact circular indicator with sapphire (`#0F52BA`) and emerald (`#007A5A`) gradients reflecting candidate match percentage against specific job requirements.