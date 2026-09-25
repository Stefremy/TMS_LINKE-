---
name: Precision Logistics Engine
colors:
  surface: '#f8faf4'
  surface-dim: '#d9dbd5'
  surface-bright: '#f8faf4'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4ef'
  surface-container: '#edeee9'
  surface-container-high: '#e7e9e3'
  surface-container-highest: '#e1e3de'
  on-surface: '#191c19'
  on-surface-variant: '#3e4a3f'
  inverse-surface: '#2e312e'
  inverse-on-surface: '#f0f1ec'
  outline: '#6e7a6e'
  outline-variant: '#bdcabc'
  surface-tint: '#006d35'
  primary: '#006b34'
  on-primary: '#ffffff'
  primary-container: '#088644'
  on-primary-container: '#f6fff3'
  inverse-primary: '#72dc8f'
  secondary: '#006d34'
  on-secondary: '#ffffff'
  secondary-container: '#7cfc9f'
  on-secondary-container: '#007438'
  tertiary: '#9f384b'
  on-tertiary: '#ffffff'
  tertiary-container: '#bf5063'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#8ef9a9'
  primary-fixed-dim: '#72dc8f'
  on-primary-fixed: '#00210c'
  on-primary-fixed-variant: '#005227'
  secondary-fixed: '#7cfc9f'
  secondary-fixed-dim: '#5edf86'
  on-secondary-fixed: '#00210b'
  on-secondary-fixed-variant: '#005226'
  tertiary-fixed: '#ffd9dc'
  tertiary-fixed-dim: '#ffb2bb'
  on-tertiary-fixed: '#400011'
  on-tertiary-fixed-variant: '#832237'
  background: '#f8faf4'
  on-background: '#191c19'
  surface-variant: '#e1e3de'
  canvas-bg: '#F5F7F5'
  surface-bg: '#FFFFFF'
  surface-muted: '#F0F3F0'
  text-primary: '#141714'
  text-secondary: '#566057'
  text-tertiary: '#788279'
  border-subtle: rgba(20, 23, 20, 0.08)
  border-strong: rgba(20, 23, 20, 0.16)
  accent-soft: '#E8F7EE'
  accent-hover: '#0E6C37'
  status-warning: '#D97706'
  status-warning-soft: '#FEF3C7'
  status-critical: '#DC2626'
  status-critical-soft: '#FEE2E2'
typography:
  headline-xl:
    fontFamily: Geist
    fontSize: 2rem
    fontWeight: '600'
    lineHeight: 2.5rem
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Geist
    fontSize: 1.5rem
    fontWeight: '600'
    lineHeight: 2rem
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 1.25rem
    fontWeight: '500'
    lineHeight: 1.75rem
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Geist
    fontSize: 1rem
    fontWeight: '500'
    lineHeight: 1.5rem
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Geist
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: 1.5rem
    letterSpacing: 0em
  body-md:
    fontFamily: Geist
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.375rem
    letterSpacing: 0em
  body-sm:
    fontFamily: Geist
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: 1.125rem
    letterSpacing: 0.005em
  label-md:
    fontFamily: Geist
    fontSize: 0.8125rem
    fontWeight: '500'
    lineHeight: 1.125rem
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Geist
    fontSize: 0.6875rem
    fontWeight: '600'
    lineHeight: 0.875rem
    letterSpacing: 0.04em
  data-mono:
    fontFamily: Geist
    fontSize: 0.8125rem
    fontWeight: '400'
    lineHeight: 1.25rem
    letterSpacing: -0.01em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-compact: 0.5rem
  margin: 1.5rem
  margin-compact: 1rem
  space-2xs: 0.125rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
  space-2xl: 2rem
---

## Brand & Style

This design system embodies an ultra-refined, developer-grade Transportation Management System (TMS) aesthetic, tailored for mission-critical enterprise supply chain visibility. It marries the disciplined efficiency of high-density dashboard software with the calm precision of modern developer tools.

### Brand Personality
- **Architectural Precision**: Every pixel, grid line, and metric is aligned with absolute intent. Data density is treated as a core capability, not clutter.
- **Instrument-Calibrated**: Evoking operational calm under heavy throughput. The visual field eliminates unnecessary cognitive drag, highlighting anomalies, routing status, and transit margins without sensory fatigue.
- **Utilitarian Elegance**: Borrowing from high-spec engineering consoles—prioritizing monospaced telemetry, razor-thin panel partitions, and tactile micro-states.

### Aesthetic Movement
The aesthetic synthesizes **developer-grade minimalism** with **technical enterprise modernism**. It relies on crisp micro-borders (`1px`), muted olive-tinted neutral hierarchies, and strict functional containment rather than decorative surfaces or heavy shadows. Accent colors are preserved strictly for active states, confirmed routes, and high-impact calls-to-action.

## Colors

The color palette enforces ruthless discipline: backgrounds are grounded in atmospheric mineral tones, text levels leverage olive-gray saturation steps for low-strain readability, and green is deployed with surgical intent.

### Color Roles & Hierarchy
- **Canvas & Surface**: The foundation sits on `canvas-bg` (`#F5F7F5`), with analytical panels elevated via `surface-bg` (`#FFFFFF`). Secondary table headers and inset controls utilize `surface-muted` (`#F0F3F0`).
- **Foreground & Text**:
  - `text-primary` (`#141714`): Definitive telemetry readings, waybills, and main headings.
  - `text-secondary` (`#566057`): Metadata, labels, secondary metrics, and table column titles.
  - `text-tertiary` (`#788279`): Inactive iconography, placeholder text, and timestamps.
- **Single Strategic Accent**: 
  - `secondary_color_hex` (`#18A957`): Primary interactive cues, successful transit pings, and selected table rows.
  - `primary_color_hex` (`#128A47`): Hover states and pressed interactive buttons.
  - `accent-soft` (`#E8F7EE`): Badge foundations, selected row indicators, and active sidebar items.
- **Borders & Separators**: Strictly constructed using `border-subtle` (`rgba(20, 23, 20, 0.08)`) for interior grid lines and `border-strong` (`rgba(20, 23, 20, 0.16)`) for container edges.

## Typography

Typography is powered entirely by **Geist**, capitalizing on its cold structural geometry and exceptional tabular numeral alignments. 

### Implementation Rules
- **Tabular Alignment**: Enable `font-variant-numeric: tabular-nums` globally across all data grids, coordinate readouts, SKU metrics, and currency columns. Numbers must stack with millimeter-grade vertical alignment.
- **Micro-Caps Data Labels**: Secondary table column headers and status tags use `label-sm` rendered in `uppercase` with `0.04em` tracking for rapid peripheral scanning.
- **Hierarchy Rhythm**: Avoid expressive typography scales. Operational dashboards thrive on compact optical balance between `0.875rem` (`body-md`) and `0.8125rem` (`data-mono`).

## Layout & Spacing

The layout model is governed by high-density tabular constraints, organized through an 8pt modular grid with 4pt subdivisions.

### Layout Philosophy
- **Split-Screen Telemetry**: The main viewport is anchored by a persistent narrow sidebar (collapsed to 56px, expanded to 220px) and a fixed multi-tier header containing global filters (Carrier, Hub, Date Range).
- **Data-Dense Grids**: The content area employs a flexible 12-column or 16-column grid system designed for side-by-side shipment ledgers, route maps, and SLA breakdown monitors.
- **Padding & Gaps**: Compact layouts minimize negative space: intra-panel padding is standard at `space-md` (`0.75rem`), expanding to `space-lg` (`1rem`) on overview canvases.
- **Responsive Adaptations**:
  - **Desktop (≥1280px)**: Multi-column tracking matrices with persistent auxiliary drawers.
  - **Tablet (768px – 1279px)**: Data tables collapse secondary columns; auxiliary sheets convert to modal slide-overs.
  - **Mobile (<768px)**: Strict vertical stacking; tabular records convert to card-based tracking units with sticky bottom CTAs.

## Elevation & Depth

This system intentionally rejects skeuomorphic shadows and blur-heavy floating layers in favor of structural panelization via low-contrast outlines.

### Depth Mechanics
- **The Flat Stack**: Depth is achieved entirely through background contrast: `#F5F7F5` (Base Ground) → `#FFFFFF` (Surface Panels) → `#F0F3F0` (Control Wells / Table Headers).
- **Micro-Borders**: Hierarchy boundaries are defined strictly through `1px solid rgba(20, 23, 20, 0.08)`. Never rely on soft dropshadows to define card boundaries.
- **Focused Overlays & Modals**: For mission-critical interruptions (e.g., manifest reconciliation, dispatch exceptions), use a sharp structural shadow:
  - `shadow-layer`: `0 1px 2px rgba(20, 23, 20, 0.05), 0 4px 12px rgba(20, 23, 20, 0.08)` accompanied by a high-contrast `1px solid rgba(20, 23, 20, 0.16)` perimeter.
- **Backdrop Overlays**: Dim backgrounds during modal focus using `rgba(20, 23, 20, 0.4)` with zero blur, preserving UI crispness.

## Shapes

With `roundedness: 1`, shapes maintain an engineered, razor-sharp discipline with slight 4px softened apexes, preventing visual harshness without degrading into playful roundedness.

### Shape Geometry
- **Components & Form Elements**: Buttons, text fields, chips, and table pills adhere to `0.25rem` (`4px`) corner radii.
- **Panel Containers**: Master dashboard panels and analytical modals utilize `rounded-lg` (`0.5rem` / `8px`).
- **Pill Indicators**: Exclusively used for discrete micro status dots (e.g., live vehicle telemetry ping), maintaining an absolute circular radius (`9999px`).

## Components

### Buttons
- **Primary**: Solid background `#128A47`, text `#FFFFFF`, border `none`, padding `0.375rem 0.75rem`. Hover shifts to `#0E6C37`. Focus rings are sharp: `2px solid #E8F7EE` with `1px` outline offset.
- **Secondary**: Background `#FFFFFF`, text `#141714`, border `1px solid rgba(20, 23, 20, 0.16)`. Hover changes background to `#F5F7F5`.
- **Tertiary / Ghost**: Transparent background, text `#566057`. Hover sets background to `rgba(20, 23, 20, 0.04)` and text to `#141714`.

### Data Tables & Rows
- **Header**: Height `32px`, background `#F0F3F0`, text `label-sm` in `#566057`, uppercase.
- **Row**: Height `40px` (dense) or `48px` (default). Border bottom `1px solid rgba(20, 23, 20, 0.08)`. Hover state: `#F5F7F5`.
- **Selected State**: Background `#E8F7EE`, left accent stripe `2px solid #18A957`.

### Status Chips & Badges
- **Format**: Height `20px`, padding `0 6px`, font `label-sm`, radius `4px`.
- **Delivered / Active**: Background `#E8F7EE`, text `#128A47`, border `1px solid rgba(18, 138, 71, 0.2)`.
- **Delayed / Caution**: Background `#FEF3C7`, text `#D97706`, border `1px solid rgba(217, 119, 6, 0.2)`.
- **Exception / Cancelled**: Background `#FEE2E2`, text `#DC2626`, border `1px solid rgba(220, 38, 38, 0.2)`.

### Form Controls
- **Inputs**: Height `32px` (dense) or `36px` (regular). Background `#FFFFFF`, border `1px solid rgba(20, 23, 20, 0.16)`, text `body-md` in `#141714`. Focus applies `border-color: #18A957` and a crisp `0 0 0 1px #18A957`.
- **Checkboxes & Radios**: Size `14px × 14px`, border `1px solid rgba(20, 23, 20, 0.3)`. Checked state filled with `#128A47` and white indicator.

### Cards & Telemetry KPI Blocks
- **Container**: Background `#FFFFFF`, border `1px solid rgba(20, 23, 20, 0.08)`, radius `8px`, padding `1rem`.
- **KPI Metrics**: Label `label-sm` in `#788279`, metric `headline-md` in `#141714` with tabular digits, subtext indicating deviation percentage with green (`#128A47`) or red (`#DC2626`) directional trend markers.