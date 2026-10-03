export interface PersonCard {
  id: string;
  name: string;
  sex: "M" | "F" | null;
  side: string;
  generation: number;
  relation: string;
  lifespan: string | null;
  born_date: string | null;
  born_place: string | null;
  died_date: string | null;
  lived: string[];
  places: string[];
  origin: string | null;
  work: string[];
  spouse: string[];
  spouse_label: string;
  parents: string[];
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

export function factsFor(person: PersonCard): Fact[] {
  const facts: Fact[] = [];
  const add = (label: string, value: string | null | undefined) => {
    if (value) facts.push({ label, value });
  };
  add("Born", [person.born_date, person.born_place].filter(Boolean).join(" · "));
  add("Died", person.died_date);
  add(person.lived.length ? "Lived" : "Places", (person.lived.length ? person.lived : person.places).join("; "));
  add("Work", person.work.join(", "));
  add(person.spouse_label, person.spouse.join(" & "));
  add("Parents", person.parents.join(" & "));
  add("Roots", person.origin);
  return facts;
}

export function toMergeVariables(person: PersonCard, variant: Variant) {
  const facts = factsFor(person);
  // The lifespan already covers "Died" wherever it is shown beside the facts.
  const withoutDied = facts.filter((fact) => fact.label !== "Died");
  const storySidebar = fitStory(person.story, SIDEBAR_AREA);
  return {
    variant,
    ...person,
    has_story: person.story_words > 0,
    facts,
    sidebar_facts: withoutDied.slice(0, 4),
    headline_facts: withoutDied.slice(0, 4),
    descent: [person.name, ...person.line],
    line_text: [person.name, ...person.line].map((name) => name.split(" ")[0]).join(" → "),
    side_label: `${person.side === "emily" ? "Emily" : "Zach"}'s side · generation ${person.generation}`,
    story_story: fitStory(person.story, STORY_AREA),
    story_sidebar: storySidebar,
    // Short stories leave the sidebar layout's prose column mostly empty.
    sidebar_descent: person.story_words > 0 && SIDEBAR_AREA.height - storySidebar.height >= DESCENT_ROOM,
  };
}

// Framework content sizes measured against the TRMNL fonts (px per average character,
// line height, paragraph gap) and the prose area of each layout at 800x480.
const SIZES = [
  { name: "xlarge", charWidth: 13.22, lineHeight: 39, gap: 18 },
  { name: "large", charWidth: 10.32, lineHeight: 27.3, gap: 12.6 },
  { name: "base", charWidth: 7.46, lineHeight: 20.8, gap: 9.6 },
];
type Area = { width: number; height: number };
const STORY_AREA: Area = { width: 780, height: 293 };
const SIDEBAR_AREA: Area = { width: 490, height: 411 };
// Height a wrapped line of descent needs under the sidebar story.
const DESCENT_ROOM = 150;
// Word wrapping leaves the end of most lines empty.
const WRAP_EFFICIENCY = 0.9;

function proseHeight(paragraphs: string[], size: (typeof SIZES)[number], area: Area): number {
  const perLine = Math.floor((area.width / size.charWidth) * WRAP_EFFICIENCY);
  const lines = paragraphs.reduce((total, paragraph) => total + Math.ceil(paragraph.length / perLine), 0);
  return lines * size.lineHeight + (paragraphs.length - 1) * size.gap;
}

/**
 * Shows the whole story at the largest size that fits; otherwise the most leading
 * paragraphs that fit at base size (always at least the first). Long stories lose
 * trailing paragraphs instead of shrinking to 12px; the content limiter still guards
 * a single oversized paragraph.
 */
export function fitStory(paragraphs: string[], area: Area) {
  for (const size of SIZES) {
    const height = proseHeight(paragraphs, size, area);
    if (height <= area.height) return { paragraphs, size: size.name, truncated: false, height };
  }
  const base = SIZES[SIZES.length - 1];
  let count = 1;
  while (count < paragraphs.length && proseHeight(paragraphs.slice(0, count + 1), base, area) <= area.height) count++;
  const kept = paragraphs.slice(0, count);
  return { paragraphs: kept, size: base.name, truncated: count < paragraphs.length, height: proseHeight(kept, base, area) };
}

export function parseVariant(value: string | null | undefined, fallback: Variant): Variant {
  return (VARIANTS as readonly string[]).includes(value || "") ? (value as Variant) : fallback;
}
