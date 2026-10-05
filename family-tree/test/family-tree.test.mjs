import assert from "node:assert/strict";
import test from "node:test";
import { ageAt, buildExport, firstSentence, parseYear, relationLabel, tidyStory } from "../scripts/export.mjs";
import { factsFor, fitStory, pickPerson, placeList, toMergeVariables } from "../src/pick.ts";

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
  assert.equal(card.born_label, "Baptized");
  assert.equal(card.born_date, "6 Feb 1742/43");
  // A baptism is not a birth, so no age is worked out from it.
  assert.equal(card.age, null);
  assert.deepEqual(card.lived, ["Kingstone, England"]);
  assert.deepEqual(card.work, ["Farmer", "Miller"]);
  assert.equal(card.spouse_label, "Married");
  // Living and possibly-living relatives appear by first name only, without dates.
  assert.deepEqual(card.line, ["grandma", "Dad", "Zach"]);
  assert.deepEqual(card.descent.map((step) => [step.name, step.year]), [
    ["great grandpa", "1743"], ["grandma", null], ["Dad", null], ["Zach", null],
  ]);
});

test("ages come only from birth events, exact when both days are known", () => {
  const event = (type, date) => ({ type, date, ...parseYear(date) });
  assert.equal(ageAt(event("birth", "10 Mar 1870"), event("death", "9 Mar 1936")), "65");
  assert.equal(ageAt(event("birth", "10 Mar 1870"), event("death", "10 Mar 1936")), "66");
  assert.equal(ageAt(event("birth", "c. 1786"), event("death", "1852")), "about 66");
  assert.equal(ageAt(event("baptism", "1 Jan 1800"), event("death", "1 Jan 1860")), null);
  assert.equal(ageAt(event("birth", "1850"), event("death", "1851")), null);
});

test("story tidying drops deceased filler and opens with the first name", () => {
  assert.deepEqual(tidyStory(["Ann Smith married Tom in 1800. Ann is deceased."], "Ann Smith"), ["Ann married Tom in 1800."]);
  assert.deepEqual(tidyStory(["Her name was Jane Doe."], "Jane Doe"), []);
  assert.deepEqual(tidyStory(["Mario, who is deceased, was the father of Rosa."], "Mario"), ["Mario was the father of Rosa."]);
  assert.deepEqual(tidyStory(["He was the father of Clara and later died."], "Walter Ash"), ["He was the father of Clara."]);
});

test("places share their region and facts skip what the dates already say", () => {
  assert.equal(placeList(["Ashby, England", "Barton, England", "Kirby, England"]), "Ashby, Barton & Kirby, England");
  assert.equal(placeList(["Springfield, OH", "Peoria, IL", "Ohio"]), "Springfield, OH; Peoria, IL; Ohio");
  const [card] = buildExport(fixture);
  const labels = factsFor({ ...card, born_date: "c. 1786", died_date: "1852", origin: "England" }).map((fact) => fact.label);
  assert.ok(!labels.includes("Baptized") && !labels.includes("Died") && !labels.includes("Roots"));
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

test("layouts lay out the line of descent by the room the story leaves", () => {
  const [card] = buildExport(fixture);
  const short = toMergeVariables(card, "sidebar");
  assert.equal(short.descent.mode, "ladder");
  assert.equal(short.descent.label, "From great to Zach");
  const long = toMergeVariables({ ...card, story: ["word ".repeat(240).trim()] }, "sidebar");
  assert.equal(long.descent.mode, "inline");
  assert.equal(long.descent.steps.map((step) => step.label).join(" → "), "great (1743) → grandma → Dad → Zach");
  const bare = toMergeVariables({ ...card, story: [] }, "sidebar");
  assert.equal(bare.story, null);
  assert.equal(bare.descent.mode, "ladder");
  const headline = toMergeVariables(card, "headline");
  assert.ok(!headline.facts.some((fact) => fact.label === "Died"));
});

