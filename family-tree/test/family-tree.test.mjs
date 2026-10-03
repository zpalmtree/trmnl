import assert from "node:assert/strict";
import test from "node:test";
import { buildExport, firstSentence, parseYear, relationLabel } from "../scripts/export.mjs";
import { fitStory, pickPerson, toMergeVariables } from "../src/pick.ts";

const proof = (assessment = "established") => ({ assessment });
const person = (id, overrides = {}) => ({
  id,
  lifeStatus: "deceased",
  names: [{ value: id.replace(/-/g, " "), display: true }],
  events: [],
  places: [],
  occupations: [],
  ancestryOrigin: null,
  lifeStory: { status: "fresh", paragraphs: [`${id} lived a life.`] },
  ...overrides,
});

// zachary <- dad (living) <- grandma (unknown, b. 1940) <- great-grandpa (deceased)
//                                                        <- candidate-born (deceased, candidate birth)
const fixture = {
  people: [
    person("zachary", { lifeStatus: "living" }),
    person("dad", { lifeStatus: "living", names: [{ value: "Dad Palmer", display: true }] }),
    person("grandma", { lifeStatus: "unknown", events: [{ type: "birth", date: "1940", proof: proof() }] }),
    person("great-grandpa", {
      events: [
        { type: "baptism", date: "6 Feb 1742/43", proof: proof() },
        { type: "death", date: "about 1800", proof: proof() },
        { type: "marriage", date: "1770", proof: proof() },
      ],
      places: [
        { value: "Kingstone, England", role: "residence", proof: proof() },
        { value: "Elsewhere", role: "residence", proof: proof("candidate") },
      ],
      occupations: ["Farmer (1771)", "farmer (1781)", "Miller"],
    }),
    person("great-grandma", {
      events: [{ type: "birth", date: "1750", proof: proof("candidate") }],
      lifeStory: { status: "missing", paragraphs: [] },
    }),
  ],
  relationships: {
    parents: [
      { childId: "zachary", parentId: "dad", role: "father" },
      { childId: "dad", parentId: "grandma", role: "mother" },
      { childId: "grandma", parentId: "great-grandpa", role: "father" },
      { childId: "grandma", parentId: "great-grandma", role: "mother" },
    ],
    couples: [{ leftPersonId: "great-grandpa", rightPersonId: "great-grandma" }],
  },
};

test("export keeps only clearly historical people and drops candidate facts", () => {
  const cards = buildExport(fixture);
  assert.deepEqual(cards.map((card) => card.id), ["great-grandpa"]);
  const [card] = cards;
  assert.equal(card.relation, "Zach's great-grandfather");
  assert.equal(card.lifespan, "1743 – c. 1800");
  assert.equal(card.born_date, "bapt. 6 Feb 1742/43");
  assert.deepEqual(card.lived, ["Kingstone, England"]);
  assert.deepEqual(card.work, ["Farmer", "Miller"]);
  assert.equal(card.spouse_label, "Married");
  // Living and possibly-living relatives appear by first name only.
  assert.deepEqual(card.line, ["grandma", "Dad", "Zach"]);
});

test("relation labels follow genealogical ordinals", () => {
  assert.equal(relationLabel("Emily's", 1, "F"), "Emily's mother");
  assert.equal(relationLabel("Emily's", 2, "M"), "Emily's grandfather");
  assert.equal(relationLabel("Emily's", 4, "F"), "Emily's 2nd great-grandmother");
  assert.equal(relationLabel("Emily's", 13, "M"), "Emily's 11th great-grandfather");
});

test("year parsing marks approximate dates", () => {
  assert.deepEqual(parseYear("20 Jan 1891"), { year: 1891, approximate: false });
  assert.deepEqual(parseYear("between 5 Jan and 12 Sep 1796"), { year: 1796, approximate: true });
  assert.deepEqual(parseYear("29 Mar 1896 or Nov 1897"), { year: 1896, approximate: true });
  assert.equal(parseYear("unknown"), null);
});

test("first sentence does not split on initials", () => {
  assert.equal(firstSentence("Cecil was the son of Joseph E. Fletcher. He worked."), "Cecil was the son of Joseph E. Fletcher.");
});

test("rotation shows everyone once per cycle and honours overrides", () => {
  const people = ["a", "b", "c", "d"].map((id, index) => ({ id, story_words: index }));
  const hour = 60 * 60_000;
  const cycle = [0, 1, 2, 3].map((slot) => pickPerson(people, { now: slot * hour, rotateMinutes: 60, pool: "all" }).id);
  assert.deepEqual([...cycle].sort(), ["a", "b", "c", "d"]);
  assert.equal(pickPerson(people, { now: 0, rotateMinutes: 60, pool: "all", id: "c" }).id, "c");
  for (let slot = 0; slot < 6; slot++) {
    assert.notEqual(pickPerson(people, { now: slot * hour, rotateMinutes: 60, pool: "story" }).id, "a");
  }
});

test("long stories drop trailing paragraphs rather than shrinking", () => {
  const paragraph = "word ".repeat(120).trim();
  const fitted = fitStory([paragraph, paragraph, paragraph], { width: 780, height: 293 });
  assert.equal(fitted.size, "base");
  assert.equal(fitted.truncated, true);
  assert.ok(fitted.paragraphs.length >= 1 && fitted.paragraphs.length < 3);
  const short = fitStory(["Short."], { width: 780, height: 293 });
  assert.deepEqual([short.paragraphs, short.size, short.truncated], [["Short."], "xlarge", false]);
  assert.ok(short.height < 293);
});

test("merge variables carry facts without repeating the lifespan", () => {
  const [card] = buildExport(fixture);
  const merged = toMergeVariables(card, "headline");
  assert.equal(merged.variant, "headline");
  assert.ok(merged.facts.some((fact) => fact.label === "Died"));
  assert.ok(!merged.headline_facts.some((fact) => fact.label === "Died"));
  assert.equal(merged.line_text, "great → grandma → Dad → Zach");
});
