# TRMNL Plugins

This directory contains Cloudflare Worker plugins for TRMNL e-ink displays.

## Projects

- **f1-standings** - F1 driver championship standings
- **f1-results** - F1 race results
- **f1-schedule** - F1 race schedule
- **world-recipes** - Random world recipes
- **pregnancy-tracker** - Pregnancy tracking
- **sol-incinerator** - Sol Incinerator stats (users, SOL reclaimed, transactions)

## Timezone Standard

**Always use Eastern Time (America/New_York)** for all date/time display and calculations.

```typescript
/**
 * Get current date/time in Eastern time
 */
function getEasternDate(): Date {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
}

// For formatting dates/times, always specify the timezone
function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}
```

## New Project Setup

### Environment Variables

Copy `.env.example` to `.env` and fill in your Cloudflare credentials:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

**Important**: When creating a new project, always copy the `.env` file from an existing TRMNL project. This ensures you use the correct Cloudflare account credentials instead of the global wrangler configuration, which may be configured for a different account.

### Development

```bash
npm install
npm run dev    # Start local dev server
npm run deploy # Deploy to Cloudflare
```

---

# TRMNL Framework Guide

Full documentation: https://usetrmnl.com/framework

We use **TRMNL OG (2-bit)** - 800x480px landscape, 4 grayscale levels.

---

## Screen Dimensions & Structure

### TRMNL OG Specs
- **Dimensions**: 800x480px (landscape), 480x800px (portrait)
- **Color depth**: 2-bit (4 grayscale levels: black, dark gray, light gray, white)
- **Content area**: 780x460px (with default 10px gap padding)

### Basic HTML Structure
```html
<div class="screen">
  <div class="view view--full">
    <div class="layout">
      <!-- Your content here -->
    </div>
    <div class="title_bar">
      <img class="image" src="icon.svg">
      <span class="title">Plugin Name</span>
      <span class="instance">Instance</span>
    </div>
  </div>
</div>
```

### CSS Variables
| Variable | Description | Default |
|----------|-------------|---------|
| `--screen-w` | Screen width | 800px |
| `--screen-h` | Screen height | 480px |
| `--full-w` | Width minus padding | calc(800px - 20px) |
| `--full-h` | Height minus padding | calc(480px - 20px) |
| `--gap` | Default gap/padding | 10px |
| `--color-depth` | Bit depth | 2 |

### Screen Modifiers
- `screen--portrait` - Swap to portrait orientation (480x800)
- `screen--no-bleed` - Remove default padding
- `screen--dark-mode` - Invert colors

---

## Layout System

### Row & Column Layouts
```html
<!-- Horizontal layout -->
<div class="layout layout--row">
  <div>Item 1</div>
  <div>Item 2</div>
</div>

<!-- Vertical layout -->
<div class="layout layout--col">
  <div>Item 1</div>
  <div>Item 2</div>
</div>
```

### Alignment Modifiers
- `layout--left`, `layout--center-x`, `layout--right` - horizontal
- `layout--top`, `layout--center-y`, `layout--bottom` - vertical
- `layout--center` - center both axes
- `layout--stretch`, `layout--stretch-x`, `layout--stretch-y` - stretch children

### Columns
```html
<div class="columns">
  <div class="column">Column 1</div>
  <div class="column">Column 2</div>
  <div class="column">Column 3</div>
</div>
```

### Grid
```html
<div class="grid grid--cols-3">
  <div>Cell 1</div>
  <div class="col--span-2">Spans 2 columns</div>
</div>
```
- `grid--cols-{1-12}` - Column count
- `col--span-{1-12}` - Span columns

### Flex
```html
<div class="flex flex--row gap--medium">
  <div class="stretch-x">Stretches</div>
  <div class="no-shrink">Won't shrink</div>
</div>
```
- `flex--row`, `flex--col`, `flex--row-reverse`, `flex--col-reverse`
- `flex--center-x`, `flex--center-y`, `flex--between`, `flex--around`
- `flex--wrap`, `flex--nowrap`
- Item: `stretch`, `stretch-x`, `stretch-y`, `no-shrink`, `grow`

---

## View Types (for Mashups)

```html
<div class="view view--full">Full screen</div>
<div class="view view--half_horizontal">Half width</div>
<div class="view view--half_vertical">Half height</div>
<div class="view view--quadrant">Quarter screen</div>
```

### Mashup Layouts
```html
<div class="mashup mashup--1Lx1R">
  <div class="view view--half_vertical">Left</div>
  <div class="view view--half_vertical">Right</div>
</div>
```
- `mashup--1Lx1R`, `mashup--1Tx1B` - 50/50 splits
- `mashup--1Lx2R`, `mashup--2Lx1R` - 1/3 + 2/3 splits
- `mashup--2x2` - Quadrant grid

---

## Text Elements

### Title
```html
<span class="title">Default Title</span>
<span class="title title--small">Small Title</span>
```

### Value (Numbers & Data)
Sizes: `value--xxsmall`, `value--xsmall`, `value--small`, (default), `value--large`, `value--xlarge`, `value--xxlarge`, `value--xxxlarge`

```html
<span class="value value--xlarge">42,000</span>
<span class="value value--large value--tnums">$1,234.56</span>
```
- `value--tnums` - Tabular numbers (consistent width digits)
- Responsive: `md:value--large`, `portrait:value--small`

### Label
```html
<span class="label">Default</span>
<span class="label label--small">Small</span>
<span class="label label--outline">Outlined</span>
<span class="label label--underline">Underlined</span>
<span class="label label--gray">Gray</span>
<span class="label label--inverted">Inverted</span>
```

### Description
```html
<span class="description">Descriptive text here</span>
```

### Text Utilities
- `text--left`, `text--center`, `text--right`, `text--justify`
- `text--black`, `text--white`
- `text--gray-10`, `text--gray-25`, `text--gray-50`, `text--gray-75`

---

## Dynamic Value Formatting

### Fit Value (Auto-resize to fit container)
```html
<!-- Numbers auto-fit width -->
<span class="value value--xxxlarge" data-value-fit="true">$1,000,000</span>

<!-- Text needs max-height constraint -->
<span class="value value--xxxlarge" data-value-fit="true" data-value-fit-max-height="340">
  Long headline text that will shrink to fit
</span>
```

### Format Value (Abbreviations: K, M, B)
```html
<span class="value value--xlarge value--tnums" data-value-format="true">2345678</span>
<!-- Displays as: 2.35M -->

<!-- With currency -->
<span class="value value--xlarge value--tnums" data-value-format="true">$2345678</span>
<!-- Displays as: $2.3M -->

<!-- Regional formatting -->
<span class="value" data-value-format="true" data-value-locale="de-DE">€123456.78</span>
```

**Currencies**: $, €, £, ¥, ₴, ₹, ₪, ₩, ₫, ₱, ₽, ₿
**Locales**: `en-US`, `de-DE`, `fr-FR`, `en-GB`, `ja-JP`

---

## Text Modulation

### Clamp (Truncate to N lines)
```html
<span class="description" data-clamp="2">Long text clamped to 2 lines...</span>
```
Legacy: `clamp--1` through `clamp--50`

### Content Limiter (Auto font-size + clamp)
```html
<div class="content" data-content-limiter="true">
  <p>Long content auto-sized and clamped</p>
</div>
<div class="content" data-content-limiter="true" data-content-max-height="140">
  <p>Custom height limit</p>
</div>
```

### Pixel Perfect (Crisp e-ink rendering)
```html
<span class="title" data-pixel-perfect="true">Crisp Text</span>
```

---

## Overflow Handling

### Column/Item Overflow
```html
<div class="columns" data-overflow-max-cols="3" data-overflow-counter="true">
  <div class="column">
    <div class="item">...</div>
    <!-- Items auto-distributed, shows "and X more" -->
  </div>
</div>
```
- `data-overflow="true"` - Enable on any container
- `data-overflow-max-cols="N"` - Best-fit up to N columns
- `data-overflow-cols="N"` - Force exactly N columns
- `data-overflow-counter="true"` - Show "and X more"
- `data-overflow-max-height="N"` or `"auto"` - Height budget

### Table Overflow
```html
<table class="table" data-table-limit="true" data-table-max-height="auto">
  <!-- Rows auto-hidden with "and X more" row -->
</table>
```

---

## Components

### Item (List Items)
```html
<!-- Simple -->
<div class="item">
  <div class="content">
    <span class="title title--small">Title</span>
    <span class="description">Description</span>
  </div>
</div>

<!-- With meta bar -->
<div class="item">
  <div class="meta"></div>
  <div class="content">
    <span class="title title--small">Title</span>
    <div class="flex gap--small">
      <span class="label label--small label--underline">Tag 1</span>
    </div>
  </div>
</div>

<!-- With index -->
<div class="item">
  <div class="meta"><span class="index">1</span></div>
  <div class="content">...</div>
</div>
```
Emphasis: `item--emphasis-1`, `item--emphasis-2`, `item--emphasis-3`

### Divider
```html
<div class="divider"></div>           <!-- Horizontal, auto-detects bg -->
<div class="divider--v"></div>        <!-- Vertical -->
<div class="divider--on-light"></div> <!-- Manual: on-white, on-light, on-dark, on-black -->
```

### Table
```html
<table class="table">
  <thead>
    <tr><th><span class="title">Column</span></th></tr>
  </thead>
  <tbody>
    <tr><td><span class="label">Data</span></td></tr>
  </tbody>
</table>
```
- `table--indexed` - Adds index column

### Progress Bar
```html
<div class="progress-bar progress-bar--large">
  <div class="content">
    <span class="label">Progress</span>
    <span class="value value--xxsmall">75%</span>
  </div>
  <div class="track">
    <div class="fill" style="width: 75%"></div>
  </div>
</div>
```
Sizes: `progress-bar--small`, `progress-bar--large`

### Progress Dots
```html
<div class="progress-dots">
  <div class="track">
    <div class="dot dot--filled"></div>
    <div class="dot dot--current"></div>
    <div class="dot"></div>
  </div>
</div>
```

### Rich Text
```html
<div class="richtext richtext--center gap--large">
  <div class="content content--center text--center" data-content-limiter="true">
    <p>Formatted text content</p>
  </div>
</div>
```

### Title Bar (Footer)
```html
<div class="title_bar">
  <img class="image" src="icon.svg" alt="Plugin">
  <span class="title">Plugin Name</span>
  <span class="instance">Instance Info</span>
</div>
```

---

## Charts

Use Highcharts/Chartkick. **CRITICAL: Disable animations!**

```html
<script src="https://usetrmnl.com/js/highcharts/12.3.0/highcharts.js"></script>
<script src="https://usetrmnl.com/js/highcharts/12.3.0/highcharts-more.js"></script>
<script src="https://usetrmnl.com/js/highcharts/12.3.0/pattern-fill.js"></script>
<script src="https://usetrmnl.com/js/chartkick/5.0.1/chartkick.min.js"></script>
```

### Key Chart Settings
```javascript
{
  chart: { animation: false, height: 260 },
  plotOptions: { series: { animation: false, lineWidth: 4 } },
  yAxis: {
    gridLineDashStyle: "shortdot",
    gridLineColor: "#000000",
    labels: { style: { fontSize: "16px", color: "#000000" } }
  },
  xAxis: {
    lineWidth: 0,
    gridLineDashStyle: "dot",
    labels: { style: { fontSize: "16px", color: "#000000" } }
  }
}
```

### Grayscale Patterns (for multi-series)
```javascript
color: {
  pattern: {
    image: "https://usetrmnl.com/images/grayscale/gray-5.png",
    width: 12, height: 12
  }
}
```
Available: `gray-2.png`, `gray-3.png`, `gray-5.png`, `gray-7.png`

Chart types: Line, Multi-series Line, Bar/Column, Gauge

---

## Backgrounds & Borders

### Backgrounds
```html
<div class="bg--black">Black</div>
<div class="bg--white">White</div>
<div class="bg--gray-10">10% gray</div>
<div class="bg--gray-25">25% gray</div>
<div class="bg--gray-50">50% gray</div>
<div class="bg--gray-75">75% gray</div>
```

### Borders
```html
<div class="border--h-1">Light horizontal</div>
<div class="border--h-5">Medium horizontal</div>
<div class="border--v-3">Vertical</div>
```
Range: `border--h-1` to `border--h-7`, `border--v-1` to `border--v-7`

### Rounded Corners
```html
<div class="rounded">8px default</div>
<div class="rounded--small">4px</div>
<div class="rounded--large">16px</div>
<div class="rounded--full">Fully round</div>
```
Sizes: `rounded--none`, `--xsmall`, `--small`, (default), `--medium`, `--large`, `--xlarge`, `--xxlarge`, `--full`

---

## Spacing & Sizing

### Gap
`gap--xsmall` (2px), `gap--small` (4px), `gap` (8px), `gap--medium` (12px), `gap--large` (16px), `gap--xlarge` (24px), `gap--xxlarge` (32px), `gap--space-between`

### Width/Height
- `w--full`, `w--auto`, `w--{4,8,12,16,20,24,32,40,48,56,64,80,96,128}`
- `h--full`, `h--auto`, `h--{sizes}`
- Arbitrary: `w--[150px]`, `h--[200px]`

### Margin/Padding
- `m--{0,2,4,8,12,16,20,24,32}`, `mt--`, `mr--`, `mb--`, `ml--`, `mx--`, `my--`
- `p--{sizes}`, `pt--`, `pr--`, `pb--`, `pl--`, `px--`, `py--`

---

## Visibility & Responsive

### Display
`hidden`, `visible`, `block`, `inline`, `inline-block`, `flex`, `grid`

### Responsive Prefixes
- **Screen size**: `sm:`, `md:`, `lg:`
- **Orientation**: `portrait:`, `landscape:`
- **Bit-depth**: `1bit:`, `2bit:`, `4bit:`

```html
<span class="value value--small md:value--large lg:value--xlarge">Responsive</span>
<span class="label portrait:label--small">Smaller in portrait</span>
<div class="hidden 2bit:block">Only on 2-bit+ displays</div>
```

---

## Image Handling

```html
<img class="image" src="icon.svg">              <!-- Standard -->
<img class="image image-dither" src="photo.jpg"> <!-- Dithered for 1-bit -->
<img class="image image--contain" src="pic.png"> <!-- Fit, preserve ratio -->
<img class="image image--cover" src="pic.png">   <!-- Cover, may crop -->
<img class="image image--fill" src="pic.png">    <!-- Stretch to fill -->
```

---

## Scale (Beta)

```html
<div class="screen screen--scale-small">87.5% scale</div>
<div class="screen screen--scale-large">112.5% scale</div>
```
Options: `--scale-xsmall` (75%), `--scale-small` (87.5%), `--scale-regular` (100%), `--scale-large` (112.5%), `--scale-xlarge` (125%), `--scale-xxlarge` (150%)

---

## Best Practices for TRMNL OG (2-bit)

1. **Leverage 4 gray levels** - Use `bg--gray-25`, `bg--gray-50`, `bg--gray-75` for visual hierarchy
2. **High contrast text** - Black on white for readability, use gray for secondary info
3. **Large text** - E-ink needs larger fonts; use `value--large` or bigger for key data
4. **Use `value--tnums`** - For numbers that need alignment (prices, stats)
5. **Disable all animations** - Charts and JS must have `animation: false`
6. **Test both orientations** - 800x480 (landscape) and 480x800 (portrait)
7. **Use `data-value-fit`** - Auto-size numbers to fit containers
8. **Use `data-value-format`** - Auto-abbreviate large numbers (K, M, B)
9. **Use overflow handling** - `data-overflow-counter` and `data-table-limit` for dynamic content
10. **Always include `title_bar`** - Plugin branding at bottom
11. **Use grayscale patterns** - For chart series differentiation
12. **Use `2bit:` prefix** - For 2-bit-specific styling when needed
