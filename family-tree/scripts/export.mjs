#!/usr/bin/env node
// Builds src/data/people.json from the private family-history repo's generated
// projections. The output is gitignored: this repo is public, the family data is not.

import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

const familyRoot = process.env.FAMILY_HISTORY_DIR || "/home/zp/zachary-palmer-family-history";
const outFile = new URL("../src/data/people.json", import.meta.url);

// Tree roots and the possessive used in relation labels.
const ROOTS = { zachary: "Zach's", emily: "Emily's" };

// Unknown life status is only shown when the person is clearly historical.
const UNKNOWN_STATUS_MIN_GENERATION = 4;
const UNKNOWN_STATUS_MAX_BIRTH_YEAR = 1916;

export function buildExport({ people, relationships }) {
  const byId = new Map(people.map((person) => [person.id, person]));
  const parentsOf = new Map();
  const sexOf = new Map();
  for (const link of relationships.parents) {
    if (!parentsOf.has(link.childId)) parentsOf.set(link.childId, []);
    parentsOf.get(link.childId).push(link.parentId);
    if (link.role === "father") sexOf.set(link.parentId, "M");
    if (link.role === "mother") sexOf.set(link.parentId, "F");
  }
  const spousesOf = new Map();
  for (const couple of relationships.couples) {
    for (const [self, other] of [[couple.leftPersonId, couple.rightPersonId], [couple.rightPersonId, couple.leftPersonId]]) {
      if (!spousesOf.has(self)) spousesOf.set(self, []);
      spousesOf.get(self).push(other);
    }
  }

  // Shortest path from each root to every ancestor, keeping the child on that path.
  const lineage = new Map();
  for (const root of Object.keys(ROOTS)) {
    const queue = [{ id: root, generation: 0, chain: [] }];
    while (queue.length) {
      const { id, generation, chain } = queue.shift();
      for (const parentId of parentsOf.get(id) || []) {
        const known = lineage.get(parentId);
        if (known && known.generation <= generation + 1) continue;
        const next = { root, generation: generation + 1, chain: [id, ...chain] };
        lineage.set(parentId, next);
        queue.push({ id: parentId, ...next });
      }
    }
  }

  const nameOf = (id) => displayName(byId.get(id)) || null;
  // Living (or possibly living) relatives in a line of descent appear by first name
  // only and without dates.
  const descentStepOf = (id) => {
    if (id in ROOTS) {
      const name = ROOTS[id].replace(/'s$/, "");
      return { name, first: name, year: null };
    }
    const line = lineage.get(id);
    const person = byId.get(id);
    const full = nameOf(id) || "";
    const birth = person && lifeEvent(person, ["birth", "baptism"]);
    if (!line || !isShareable(person, line.generation, birth)) return { name: firstName(full), first: firstName(full), year: null };
    return { name: full, first: firstName(full), year: birth ? `${birth.approximate ? "c. " : ""}${birth.year}` : null };
  };
  const cards = [];
  for (const [id, line] of lineage) {
    const person = byId.get(id);
    if (!person) continue;
    const birth = lifeEvent(person, ["birth", "baptism"]);
    const death = lifeEvent(person, ["death", "burial"]);
    if (!isShareable(person, line.generation, birth)) continue;

    const story = lifeStoryFor(person);
    const storyWords = story.join(" ").split(/\s+/).filter(Boolean).length;
    const lived = placeValues(person, ["residence"]);
    const born = placeValues(person, ["birthplace", "baptism-place"])[0] || null;
    const marriage = person.events.find((event) => event.type === "marriage" && isUsable(event.proof));
    const descent = [id, ...line.chain].map(descentStepOf);
    const card = {
      id,
      name: nameOf(id),
      sex: sexOf.get(id) || null,
      side: line.root,
      generation: line.generation,
      relation: relationLabel(ROOTS[line.root], line.generation, sexOf.get(id)),
      lifespan: lifespan(birth, death),
      age: ageAt(birth, death),
      born_label: birth?.type === "baptism" ? "Baptized" : "Born",
      born_date: birth?.date || null,
      born_place: born,
      died_label: death?.type === "burial" ? "Buried" : "Died",
      died_date: death?.date || null,
      lived: lived.filter((place) => place !== born).slice(0, 3),
      places: placeValues(person, ["associated", "marriage-place", "burial-place", "death-place"]).slice(0, 3),
      origin: person.ancestryOrigin || null,
      work: occupations(person).slice(0, 3),
      spouse: (spousesOf.get(id) || []).map(nameOf).filter(Boolean).slice(0, 2),
      spouse_label: marriage ? "Married" : "Partner",
      married_year: marriage ? parseYear(marriage.date)?.year ?? null : null,
      parents: (parentsOf.get(id) || []).map(nameOf).filter(Boolean),
      descent,
      line: descent.slice(1).map((step) => step.name),
      story,
      hook: firstSentence(story[0]),
      story_words: storyWords,
      story_status: person.lifeStory.status
    };
    // A story that was all filler still earns a place: the card shows facts and descent.
    if (!hasLifeStory(person.lifeStory) && !(card.lifespan && (card.born_place || card.lived.length || card.places.length || card.work.length))) continue;
    cards.push(card);
  }
  return cards.sort((first, second) => first.id.localeCompare(second.id));
}

function isShareable(person, generation, birth) {
  if (person.lifeStatus === "deceased") return true;
  if (person.lifeStatus !== "unknown") return false;
  return generation >= UNKNOWN_STATUS_MIN_GENERATION
    || (birth?.year != null && birth.year <= UNKNOWN_STATUS_MAX_BIRTH_YEAR);
}

// Candidate facts are unproven identity matches, so they never reach the display.
const isUsable = (proof) => proof?.assessment !== "candidate" && proof?.assessment !== "rejected";

function displayName(person) {
  if (!person) return "";
  return (person.names.find((name) => name.display) || person.names[0])?.value || "";
}

function lifeEvent(person, types) {
  for (const type of types) {
    const event = person.events.find((item) => item.type === type && isUsable(item.proof));
    if (!event) continue;
    const parsed = parseYear(event.date);
    if (!parsed) continue;
    return { ...parsed, type, date: event.date };
  }
  return null;
}

export function parseYear(date) {
  const dual = String(date).match(/\b(1\d)(\d{2})\/(\d{2})\b/);
  const plain = String(date).match(/\b(1\d{3}|20\d{2})\b/);
  if (!dual && !plain) return null;
  const year = dual ? Number(dual[1] + dual[3]) : Number(plain[1]);
  const approximate = /^(?:c\.|(?:about|abt|before|after|between|by)\b)/i.test(date)
    || /\bor\b|\d{4}\s*[–-]\s*\d{4}/i.test(date);
  return { year, approximate };
}

function lifespan(birth, death) {
  const year = (event) => `${event.approximate ? "c. " : ""}${event.year}`;
  if (birth && death) return `${year(birth)} – ${year(death)}`;
  if (birth) return `${birth.type === "baptism" ? "baptized" : "born"} ${year(birth)}`;
  if (death) return `${death.type === "burial" ? "buried" : "died"} ${year(death)}`;
  return null;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// "25 Dec 1793" or "6 Feb 1742/43" (the later year of a dual date); nothing vaguer.
function exactDate(event) {
  const match = !event.approximate && String(event.date).match(/^(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4})(?:\/\d{2})?$/);
  const month = match ? MONTHS.indexOf(match[2].toLowerCase()) : -1;
  return month < 0 ? null : { year: event.year, month, day: Number(match[1]) };
}

/**
 * Age at death, only from a real birth event (a baptism can be years late). Exact when
 * both days are known, otherwise "about". Ancestors all reached adulthood, so a young
 * age means conflicting dates and is left out.
 */
export function ageAt(birth, death) {
  if (birth?.type !== "birth" || !death) return null;
  const from = exactDate(birth);
  const to = death.type === "death" ? exactDate(death) : null;
  if (from && to) {
    const age = to.year - from.year - (to.month < from.month || (to.month === from.month && to.day < from.day) ? 1 : 0);
    return age >= 15 ? String(age) : null;
  }
  const age = death.year - birth.year;
  return age >= 15 ? `about ${age}` : null;
}

function placeValues(person, roles) {
  const values = person.places
    .filter((place) => roles.includes(place.role) && isUsable(place.proof))
    .map((place) => place.value);
  return [...new Set(values)];
}

function occupations(person) {
  const seen = new Map();
  for (const raw of person.occupations) {
    const value = raw.replace(/\s*\([^)]*\)\s*$/, "").trim();
    const key = value.toLowerCase();
    if (value && !seen.has(key)) seen.set(key, value);
  }
  return [...seen.values()];
}

// Splits after a sentence end, but not after an initial such as "Joseph E. Fletcher".
const SENTENCE_END = /(?<=[a-z0-9)”"’][.!?])\s+(?=[A-Z“"])/;

export function firstSentence(text) {
  if (!text) return null;
  return text.split(SENTENCE_END)[0];
}

const firstName = (name) => name.split(" ")[0];

const hasLifeStory = (lifeStory) => ["fresh", "stale"].includes(lifeStory?.status) && lifeStory.paragraphs?.length > 0;

function lifeStoryFor(person) {
  return hasLifeStory(person.lifeStory) ? tidyStory(person.lifeStory.paragraphs, displayName(person)) : [];
}

// Sentences that only restate what the card already shows: everyone here is deceased,
// and the name is printed above the story.
const FILLER_SENTENCES = [/^(?:She|He|[A-Z][^\s,]*) is (?:now )?deceased\.$/, /^(?:Her|His) name was [^.]+\.$/];
const FILLER_CLAUSES = [/, (?:who is|now) deceased,/g, / and (?:is )?(?:now )?deceased(?=\.)/g, / and later died(?=\.)/g];

/**
 * Light cleanup of the life-story text for a screen that already shows the name and
 * dates: drops filler about being deceased and opens with the first name instead of
 * the full name. It never adds information.
 */
export function tidyStory(paragraphs, name) {
  const tidied = paragraphs.map((paragraph) => {
    let text = paragraph;
    for (const clause of FILLER_CLAUSES) text = text.replace(clause, "");
    return text.split(SENTENCE_END).filter((sentence) => !FILLER_SENTENCES.some((filler) => filler.test(sentence))).join(" ");
  }).filter(Boolean);
  const opening = tidied[0] || "";
  if (name.includes(" ") && (opening.startsWith(`${name} `) || opening.startsWith(`${name},`))) {
    tidied[0] = firstName(name) + opening.slice(name.length);
  }
  return tidied;
}

export function relationLabel(possessive, generation, sex) {
  const base = sex === "M" ? "father" : sex === "F" ? "mother" : "parent";
  if (generation === 1) return `${possessive} ${base}`;
  if (generation === 2) return `${possessive} grand${base}`;
  if (generation === 3) return `${possessive} great-grand${base}`;
  return `${possessive} ${ordinal(generation - 2)} great-grand${base}`;
}

function ordinal(value) {
  const suffix = value % 100 >= 11 && value % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[value % 10] || "th");
  return `${value}${suffix}`;
}

// Reads the committed projections rather than the working tree, so research in
// progress in that repo never reaches the display.
export function readCommitted(name) {
  const output = execFileSync("git", ["-C", familyRoot, "show", `HEAD:data/family/${name}`], {
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(output);
}

export async function writeExport() {
  const { people } = readCommitted("people.json");
  const relationships = readCommitted("relationships.json");
  const cards = buildExport({ people, relationships });
  await mkdir(new URL(".", outFile), { recursive: true });
  await writeFile(outFile, `${JSON.stringify({ exportedAt: new Date().toISOString(), people: cards })}\n`);
  const withStory = cards.filter((card) => card.story_words > 0).length;
  console.log(`exported ${cards.length} people (${withStory} with a life story) to src/data/people.json`);
  return cards;
}

if (import.meta.url === `file://${process.argv[1]}`) await writeExport();
