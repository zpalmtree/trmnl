export interface DescentStep {
  name: string;
  first: string;
  year: string | null;
}

export interface PersonCard {
  id: string;
  name: string;
  sex: "M" | "F" | null;
  side: string;
  generation: number;
  relation: string;
  lifespan: string | null;
  age: string | null;
  born_label: string;
  born_date: string | null;
  born_place: string | null;
  died_label: string;
  died_date: string | null;
  lived: string[];
  places: string[];
  origin: string | null;
  work: string[];
  spouse: string[];
  spouse_label: string;
  married_year: number | null;
  parents: string[];
  descent: DescentStep[];
  line: string[];
  story: string[];
  hook: string | null;
  story_words: number;
  story_status: string;
}

export const VARIANTS = ["story", "sidebar", "headline"] as const;
export type Variant = (typeof VARIANTS)[number];
export type Pool = "all" | "story";

interface PickOptions {
  now: number;
  rotateMinutes: number;
  pool: Pool;
  id?: string | null;
}

/**
 * Deterministic rotation: every slot of `rotateMinutes` shows the next person in a
 * shuffled order, reshuffled each full cycle, so nobody repeats until everyone has
 * had a turn and no storage is needed.
 */
export function pickPerson(people: PersonCard[], options: PickOptions): PersonCard | null {
  if (options.id) return people.find((person) => person.id === options.id) || null;
  const pool = options.pool === "story" ? people.filter((person) => person.story_words > 0) : people;
  if (!pool.length) return null;
  const slot = Math.floor(options.now / (Math.max(1, options.rotateMinutes) * 60_000));
  const cycle = Math.floor(slot / pool.length);
  const order = shuffle([...pool].sort((a, b) => a.id.localeCompare(b.id)), cycle + 1);
  return order[slot % pool.length];
}

function shuffle<T>(items: T[], seed: number): T[] {
  let state = seed >>> 0 || 1;
  const random = () => {
    // mulberry32
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let index = items.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [items[index], items[swap]] = [items[swap], items[index]];
  }
  return items;
}

export interface Fact {
  label: string;
  value: string;
}

/** Facts in priority order; layouts take as many as fit without clipping. */
export function factsFor(person: PersonCard): Fact[] {
  const facts: Fact[] = [];
  const add = (label: string, value: string | null | undefined) => {
    if (value) facts.push({ label, value });
  };
  const places = person.lived.length ? person.lived : person.places;
  // A bare year is already in the lifespan.
  const born = isBareYear(person.born_date) ? null : person.born_date;
  add(person.born_label, [born, person.born_place].filter(Boolean).join(" · "));
  add(person.lived.length ? "Lived" : "Places", placeList(places));
  add("Work", person.work.join(", "));
  const spouse = person.spouse.join(" & ");
  add(person.spouse_label, spouse && person.married_year && person.spouse.length === 1 ? `${spouse} in ${person.married_year}` : spouse);
  add("Parents", person.parents.join(" & "));
  if (!originIsShown(person.origin, [person.born_place, ...places])) add("Roots", person.origin);
  if (!isBareYear(person.died_date)) add(person.died_label, person.died_date);
  return facts;
}

const isBareYear = (date: string | null) => !date || /^(?:c\. )?\d{4}(?:\/\d{2})?$/.test(date);

/** "Ashby, England; Barton, England" reads as "Ashby & Barton, England". */
export function placeList(places: string[]): string {
  const groups = new Map<string, string[]>();
  for (const place of places) {
    const cut = place.lastIndexOf(", ");
    const [local, region] = cut < 0 ? [place, ""] : [place.slice(0, cut), place.slice(cut + 2)];
    groups.set(region, [...(groups.get(region) || []), local]);
  }
  return [...groups].map(([region, locals]) => {
    const joined = locals.length > 1 ? `${locals.slice(0, -1).join(", ")} & ${locals.at(-1)}` : locals[0];
    return region ? `${joined}, ${region}` : joined;
  }).join("; ");
}

const US_STATE = /(?:, [A-Z]{2}|\b(?:Ohio|Pennsylvania|Maryland|New York|Virginia|Illinois|Wisconsin|Michigan|Minnesota|Texas))$/;

// "Roots: England" adds nothing beside places already in England.
function originIsShown(origin: string | null, places: (string | null)[]): boolean {
  if (!origin) return true;
  return places.some((place) => place && (place.endsWith(origin) || (origin === "United States" && US_STATE.test(place))));
}

// Layout box at 800x480 with no title bar.
const SCREEN = { width: 780, height: 460 };

/**
 * The device's Presentation setting picks the framework font family, and the two
 * differ a lot: under "classic", 21px TRMNL21 becomes 26px BlockKie and 12px labels
 * become 16px. Per family: average px per character over the real stories, names and
 * facts (`npm run preview -- --calibrate`), and rendered line height.
 */
export type Fonts = "classic" | "trmnl";
type Type = { charWidth: number; lineHeight: number };
// Story sizes (`content--*` at the markup's 1.3 line height and 0.6em paragraph gap).
type StorySize = Type & { name: string; gap: number };
interface Metrics {
  label: Type;
  base: Type;
  large: Type;
  titleSmall: Type;
  titleLarge: Type;
  titleXlarge: Type;
  valueXsmall: Type;
  valueSmall: Type;
  story: StorySize[];
}
const METRICS: Record<Fonts, Metrics> = {
  classic: {
    label: { charWidth: 6.43, lineHeight: 18 },
    base: { charWidth: 8.65, lineHeight: 20 },
    large: { charWidth: 11.36, lineHeight: 32.5 },
    titleSmall: { charWidth: 8.52, lineHeight: 16 },
    titleLarge: { charWidth: 14.72, lineHeight: 36 },
    titleXlarge: { charWidth: 17.06, lineHeight: 42 },
    valueXsmall: { charWidth: 9.38, lineHeight: 24 },
    valueSmall: { charWidth: 11.8, lineHeight: 29 },
    story: [
      { name: "xlarge", charWidth: 13.42, lineHeight: 39, gap: 18 },
      { name: "large", charWidth: 11, lineHeight: 33.8, gap: 15.6 },
      { name: "base", charWidth: 8.41, lineHeight: 20.8, gap: 9.6 },
    ],
  },
  trmnl: {
    label: { charWidth: 6.03, lineHeight: 14 },
    base: { charWidth: 7.75, lineHeight: 20 },
    large: { charWidth: 10.93, lineHeight: 26.25 },
    titleSmall: { charWidth: 8.02, lineHeight: 16 },
    titleLarge: { charWidth: 14.72, lineHeight: 36 },
    titleXlarge: { charWidth: 17.06, lineHeight: 42 },
    valueXsmall: { charWidth: 9.38, lineHeight: 24 },
    valueSmall: { charWidth: 11.8, lineHeight: 29 },
    story: [
      { name: "xlarge", charWidth: 13.42, lineHeight: 39, gap: 18 },
      { name: "large", charWidth: 10.53, lineHeight: 27.3, gap: 12.6 },
      { name: "base", charWidth: 7.6, lineHeight: 20.8, gap: 9.6 },
    ],
  },
};

export function parseFonts(value: string | null | undefined): Fonts {
  return value === "trmnl" ? "trmnl" : "classic";
}

// Proportional glyphs vary around the average, so wrap a little early.
const SAFE_WIDTH = 0.94;

/** Greedy word wrap against an average character width. */
export function lineCount(text: string, charWidth: number, width: number): number {
  const limit = width * SAFE_WIDTH;
  let lines = 1;
  let used = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const size = word.length * charWidth;
    if (used && used + charWidth + size > limit) {
      lines++;
      used = size;
    } else {
      used += (used ? charWidth : 0) + size;
    }
  }
  return lines;
}

const textHeight = (text: string, type: Type, width: number) => lineCount(text, type.charWidth, width) * type.lineHeight;
// A label above a base-size value, as facts are set.
const factHeight = (fact: Fact, width: number, m: Metrics) => m.label.lineHeight + 2 + textHeight(fact.value, m.base, width);

type Area = { width: number; height: number };

function proseHeight(paragraphs: string[], size: StorySize, width: number): number {
  const lines = paragraphs.reduce((total, paragraph) => total + lineCount(paragraph, size.charWidth, width), 0);
  return lines * size.lineHeight + (paragraphs.length - 1) * size.gap;
}

/**
 * Shows the whole story at the largest size that fits; otherwise the most leading
 * paragraphs that fit at base size (always at least the first). Long stories lose
 * trailing paragraphs instead of shrinking to 12px; the content limiter still guards
 * a single oversized paragraph.
 */
export function fitStory(paragraphs: string[], area: Area, fonts: Fonts = "classic") {
  const sizes = METRICS[fonts].story;
  for (const size of sizes) {
    const height = proseHeight(paragraphs, size, area.width);
    if (height <= area.height) return { paragraphs, size: size.name, truncated: false, height };
  }
  const base = sizes[sizes.length - 1];
  let count = 1;
  while (count < paragraphs.length && proseHeight(paragraphs.slice(0, count + 1), base, area.width) <= area.height) count++;
  const kept = paragraphs.slice(0, count);
  return { paragraphs: kept, size: base.name, truncated: count < paragraphs.length, height: proseHeight(kept, base, area.width) };
}

/** Takes facts in priority order while their stacked height fits. */
function fitFacts(facts: Fact[], width: number, height: number, gap: number, m: Metrics) {
  const kept: Fact[] = [];
  let used = 0;
  for (const fact of facts) {
    const next = used + (kept.length ? gap : 0) + factHeight(fact, width, m);
    if (next > height) continue;
    kept.push(fact);
    used = next;
  }
  return { facts: kept, height: used };
}

interface Descent {
  label: string;
  steps: (DescentStep & { label: string; self: boolean; root: boolean })[];
  // Inline: one wrapped sentence of steps. Ladder: one step per row.
  mode: "inline" | "ladder";
  size: "base" | "large";
  short: boolean;
  height: number;
}

// Rule, padding and gap around the label; year column gap, rule and name indent;
// vertical padding of each rung.
const descentHead = (m: Metrics) => 1 + 8 + m.label.lineHeight + 6;
const LADDER_INDENT = 12 + 3 + 12;
const LADDER_RUNG_PADDING = 4;

function descentFor(person: PersonCard, width: number, m: Metrics, mode: Descent["mode"], size: Descent["size"] = "base"): Descent | null {
  const steps = person.descent.map((step, index) => ({
    ...step,
    self: index === 0,
    root: index === person.descent.length - 1,
    label: "",
  }));
  const label = `From ${steps[0].first} to ${steps.at(-1)!.name}`;
  // The person's full name is already the title.
  const named = (short: boolean) => steps.map((step) => ({
    ...step,
    label: `${short || step.self ? step.first : step.name}${step.year ? ` (${step.year})` : ""}`,
  }));
  if (mode === "ladder") {
    const type = m[size];
    const widest = Math.max(...steps.map((step) => step.name.length)) * type.charWidth;
    const years = Math.max(...steps.map((step) => (step.year || "").length)) * type.charWidth;
    if (widest + years + LADDER_INDENT > width * SAFE_WIDTH) return null;
    const height = descentHead(m) + steps.length * (type.lineHeight + LADDER_RUNG_PADDING);
    return { label, steps, mode, size, short: false, height };
  }
  // Full names when they fit in two lines, otherwise first names, which always wrap.
  for (const short of [false, true]) {
    const labelled = named(short);
    const lines = lineCount(labelled.map((step) => step.label).join(" → "), m.base.charWidth, width);
    if (short || lines <= 2) return { label, steps: labelled, mode, size, short, height: descentHead(m) + lines * m.base.lineHeight };
  }
  return null;
}

export function toMergeVariables(person: PersonCard, variant: Variant, fonts: Fonts = "classic") {
  const m = METRICS[fonts];
  const facts = factsFor(person);
  const shared = {
    variant,
    id: person.id,
    name: person.name,
    relation: person.relation,
    lifespan: person.lifespan,
    age: person.age ? `lived to ${person.age}` : null,
  };
  if (variant === "story") return { ...shared, ...planStory(person, facts, fonts, m) };
  if (variant === "headline") return { ...shared, ...planHeadline(person, facts, m) };
  return { ...shared, ...planSidebar(person, facts, fonts, m) };
}

const SIDE = { width: 270, inner: 249, gap: 10 };
const MAIN_WIDTH = SCREEN.width - SIDE.width - 20;
const SECTION_GAP = 16;

/**
 * Identity and facts on the left; story on the right with the line of descent below
 * it, as a ladder when there is room and as one wrapped line when there is not.
 */
function planSidebar(person: PersonCard, facts: Fact[], fonts: Fonts, m: Metrics) {
  let side = textHeight(person.relation, m.titleSmall, SIDE.inner) + SIDE.gap
    + textHeight(person.name, m.titleLarge, SIDE.inner);
  if (person.lifespan) side += SIDE.gap + m.valueXsmall.lineHeight + (person.age ? 2 + m.base.lineHeight : 0);
  // Every fact after the first is preceded by a gap; the first by the section gap.
  const fitted = fitFacts(facts, SIDE.inner, SCREEN.height - side - SECTION_GAP, SIDE.gap, m);
  // The ladder never outsizes the story above it.
  const ladder = (room: number, large = true) => [large && descentFor(person, MAIN_WIDTH, m, "ladder", "large"), descentFor(person, MAIN_WIDTH, m, "ladder")]
    .find((option) => option && option.height <= room) || null;

  if (!person.story.length) {
    return { facts: fitted.facts, story: null, descent: ladder(SCREEN.height) || descentFor(person, MAIN_WIDTH, m, "inline") };
  }
  const inline = descentFor(person, MAIN_WIDTH, m, "inline")!;
  const story = fitStory(person.story, { width: MAIN_WIDTH, height: SCREEN.height - inline.height - SECTION_GAP }, fonts);
  // The whole story matters more than the line of descent.
  if (story.truncated) {
    const whole = fitStory(person.story, { width: MAIN_WIDTH, height: SCREEN.height }, fonts);
    if (!whole.truncated) return { facts: fitted.facts, story: whole, descent: null };
  }
  return { facts: fitted.facts, story, descent: ladder(SCREEN.height - story.height - SECTION_GAP, story.size !== "base") || inline };
}

const GRID = { columns: 3, gap: 24, rowGap: 12 };

/** Name across the top, the story full width, facts beneath when there is room. */
function planStory(person: PersonCard, facts: Fact[], fonts: Fonts, m: Metrics) {
  const age = person.lifespan && person.age ? `lived to ${person.age}` : "";
  const datesWidth = Math.max((person.lifespan || "").length * m.valueSmall.charWidth, age.length * m.base.charWidth);
  const nameLines = lineCount(person.name, m.titleXlarge.charWidth, SCREEN.width - datesWidth - 16);
  const who = m.titleSmall.lineHeight + nameLines * m.titleXlarge.lineHeight;
  const when = person.lifespan ? m.valueSmall.lineHeight + (age ? m.base.lineHeight : 0) : 0;
  const head = Math.max(who, when) + 8 + 3;
  const descent = descentFor(person, SCREEN.width, m, "inline")!;
  const body = SCREEN.height - head - descent.height - 12 - 8;

  const cellWidth = (SCREEN.width - (GRID.columns - 1) * GRID.gap) / GRID.columns;
  const grid = (kept: Fact[]) => {
    let height = 0;
    for (let row = 0; row < kept.length; row += GRID.columns) {
      height += (row ? GRID.rowGap : 0) + Math.max(...kept.slice(row, row + GRID.columns).map((fact) => factHeight(fact, cellWidth, m)));
    }
    return height;
  };
  const withoutDied = facts.filter((fact) => !/^(?:Died|Buried)$/.test(fact.label));
  // Fill whole rows of facts under the story while they fit.
  const factsUnder = (used: number) => {
    let kept: Fact[] = [];
    for (let count = GRID.columns; count <= withoutDied.length + GRID.columns - 1; count += GRID.columns) {
      const candidate = withoutDied.slice(0, count);
      if (used + grid(candidate) > body) break;
      kept = candidate;
    }
    return kept;
  };
  if (!person.story.length) return { story: null, facts: factsUnder(0), descent };

  const story = fitStory(person.story, { width: SCREEN.width, height: body }, fonts);
  if (story.truncated) {
    const whole = fitStory(person.story, { width: SCREEN.width, height: body + descent.height }, fonts);
    if (!whole.truncated) return { story: whole, facts: [], descent: null };
  }
  return { story, facts: factsUnder(story.height + SECTION_GAP), descent };
}

/** Large name and dates with the opening line, four fact cells, descent at the foot. */
function planHeadline(person: PersonCard, facts: Fact[], m: Metrics) {
  const descent = descentFor(person, SCREEN.width, m, "inline")!;
  const withoutDied = facts.filter((fact) => !/^(?:Died|Buried)$/.test(fact.label));
  // Up to four cells; drop any fact that would need more than three lines.
  let cells: Fact[] = [];
  for (let count = Math.min(4, withoutDied.length); count > 0; count--) {
    const width = (SCREEN.width - (count - 1) * 24) / count;
    const fitting = withoutDied.filter((fact) => lineCount(fact.value, m.base.charWidth, width) <= 3).slice(0, count);
    if (fitting.length === count || count === 1) {
      cells = fitting;
      break;
    }
  }
  const hook = person.hook;
  const hookSize = !hook ? null
    : lineCount(hook, m.large.charWidth, 700) <= 3 ? "large"
    : lineCount(hook, m.base.charWidth, 700) <= 4 ? "base" : null;
  return { hook: hookSize ? hook : null, hook_size: hookSize, facts: cells, descent };
}

export function parseVariant(value: string | null | undefined, fallback: Variant): Variant {
  return (VARIANTS as readonly string[]).includes(value || "") ? (value as Variant) : fallback;
}
