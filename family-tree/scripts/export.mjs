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
  // Living (or possibly living) relatives in a line of descent appear by first name only.
  const lineNameOf = (id) => {
    if (id in ROOTS) return ROOTS[id].replace(/'s$/, "");
    const line = lineage.get(id);
    const person = byId.get(id);
    const full = nameOf(id) || "";
    return line && isShareable(person, line.generation, lifeEvent(person, ["birth", "baptism"])) ? full : full.split(" ")[0];
  };
  const cards = [];
  for (const [id, line] of lineage) {
    const person = byId.get(id);
    if (!person) continue;
    const birth = lifeEvent(person, ["birth", "baptism"]);
    const death = lifeEvent(person, ["death", "burial"]);
    if (!isShareable(person, line.generation, birth)) continue;

    const story = person.lifeStory.status === "fresh" || person.lifeStory.status === "stale"
      ? person.lifeStory.paragraphs : [];
    const storyWords = story.join(" ").split(/\s+/).filter(Boolean).length;
    const lived = placeValues(person, ["residence"]);
    const born = placeValues(person, ["birthplace", "baptism-place"])[0] || null;
    const card = {
      id,
      name: nameOf(id),
      sex: sexOf.get(id) || null,
      side: line.root,
      generation: line.generation,
      relation: relationLabel(ROOTS[line.root], line.generation, sexOf.get(id)),
      lifespan: lifespan(birth, death),
      born_date: birth?.label || null,
      born_place: born,
      died_date: death?.label || null,
      lived: lived.filter((place) => place !== born).slice(0, 3),
      places: placeValues(person, ["associated", "marriage-place", "burial-place", "death-place"]).slice(0, 3),
      origin: person.ancestryOrigin || null,
      work: occupations(person).slice(0, 3),
      spouse: (spousesOf.get(id) || []).map(nameOf).filter(Boolean).slice(0, 2),
      spouse_label: person.events.some((event) => event.type === "marriage" && isUsable(event.proof)) ? "Married" : "Partner",
      parents: (parentsOf.get(id) || []).map(nameOf).filter(Boolean),
      line: line.chain.map(lineNameOf),
      story,
      hook: firstSentence(story[0]),
      story_words: storyWords,
      story_status: person.lifeStory.status
    };
    if (!storyWords && !(card.lifespan && (card.born_place || card.lived.length || card.places.length || card.work.length))) continue;
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
    const prefix = type === "baptism" ? "bapt. " : type === "burial" ? "bur. " : "";
    return { ...parsed, label: `${prefix}${event.date}` };
  }
  return null;
}

export function parseYear(date) {
  const dual = String(date).match(/\b(1\d)(\d{2})\/(\d{2})\b/);
  const plain = String(date).match(/\b(1\d{3}|20\d{2})\b/);
  if (!dual && !plain) return null;
  const year = dual ? Number(dual[1] + dual[3]) : Number(plain[1]);
  const approximate = /^(?:c\.|about|abt|before|after|between|by)\b/i.test(date)
    || /\bor\b|\d{4}\s*[–-]\s*\d{4}/i.test(date);
  return { year, approximate };
}

function lifespan(birth, death) {
  if (!birth && !death) return null;
  const show = (event) => (event ? `${event.approximate ? "c. " : ""}${event.year}` : "?");
  return `${show(birth)} – ${show(death)}`;
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
export function firstSentence(text) {
  if (!text) return null;
  return text.split(/(?<=[a-z0-9)”"’][.!?])\s+(?=[A-Z“"])/)[0];
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
function readCommitted(name) {
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
