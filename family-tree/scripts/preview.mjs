#!/usr/bin/env node
// Renders every layout variant for a sample of people into preview.html, so copy and
// layout can be compared side by side at the device's real 800x480 size.
//
//   npm run preview                       # default sample across story lengths
//   npm run preview -- --ids a,b,c        # specific people
//   npm run preview -- --all --offset 40  # everyone, 40 people per page
//   npm run preview -- --audit            # everyone, measured one at a time
//   npm run preview -- --fonts trmnl      # the other device font family
//   npm run preview -- --calibrate        # measure character widths for src/pick.ts
//
// Keep pages to ~40 people: hundreds of framework iframes outlast the shared browser
// bridge's 45s tool timeout and drop the session's Playwright connection.

import { readFile, writeFile } from "node:fs/promises";
import { Liquid } from "liquidjs";
import { VARIANTS, parseFonts, toMergeVariables } from "../src/pick.ts";

const FRAMEWORK = "3.4.0";
const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);

const { people } = JSON.parse(await readFile(new URL("../src/data/people.json", import.meta.url), "utf8"));
const markup = await readFile(new URL("../src/markup.html", import.meta.url), "utf8");
const liquid = new Liquid({ strictFilters: true });
// Match the device's Presentation setting: font family changes every text size.
const fonts = parseFonts(option("--fonts"));
const render = (person, variant) => liquid.parseAndRender(markup, toMergeVariables(person, variant, fonts));

function defaultSample() {
  const byWords = [...people].sort((a, b) => b.story_words - a.story_words);
  const nearest = (words, side) => byWords
    .filter((person) => person.side === side)
    .reduce((best, person) => Math.abs(person.story_words - words) < Math.abs(best.story_words - words) ? person : best);
  const picks = [
    byWords[0],
    nearest(140, "emily"),
    nearest(70, "zachary"),
    nearest(35, "emily"),
    nearest(15, "zachary"),
    byWords.find((person) => person.story_words === 0 && person.side === "emily"),
  ];
  return [...new Map(picks.filter(Boolean).map((person) => [person.id, person])).values()];
}

const PAGE_SIZE = 40;
const offset = Number(option("--offset")) || 0;
const audit = args.includes("--audit");
const sample = audit && !args.includes("--ids") ? people
  : args.includes("--all") ? people.slice(offset, offset + PAGE_SIZE)
  : args.includes("--ids") ? option("--ids").split(",").map((id) => {
    const person = people.find((item) => item.id === id);
    if (!person) throw new Error(`unknown person: ${id}`);
    return person;
  })
  : defaultSample();

const escapeAttr = (value) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
const screen = (body) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://trmnl.com/css/${FRAMEWORK}/plugins.css">
<script src="https://trmnl.com/js/${FRAMEWORK}/plugins.js"></script>
<style>html,body{margin:0}</style></head>
<body class="environment trmnl"><div class="screen screen--2bit screen--ogv2 screen--md screen--1x screen--fonts-${fonts} screen--density-1x"><div class="view view--full">${body}</div></div></body></html>`;

if (args.includes("--calibrate")) {
  await writeFile(new URL("../preview-calibrate.html", import.meta.url), calibratePage());
  console.log("wrote preview-calibrate.html; read window.calibration");
  process.exit(0);
}

if (audit) {
  const renders = [];
  for (const person of sample) {
    for (const variant of VARIANTS) {
      renders.push({ id: person.id, variant, html: screen(await render(person, variant)) });
    }
  }
  await writeFile(new URL("../preview-audit.html", import.meta.url), auditPage(renders));
  console.log(`wrote preview-audit.html: ${renders.length} renders (${fonts} fonts); read window.audit once window.auditDone is true`);
  process.exit(0);
}

const rows = [];
for (const person of sample) {
  const cells = [];
  for (const variant of VARIANTS) {
    const body = await render(person, variant);
    cells.push(`<figure><figcaption>${variant}</figcaption>
<div class="frame"><iframe srcdoc="${escapeAttr(screen(body))}" width="800" height="480"></iframe></div></figure>`);
  }
  rows.push(`<section id="${person.id}"><h2>${person.name} <small>${person.id} · ${person.relation} · ${person.story_words} words (${person.story_status})</small></h2>
<div class="row">${cells.join("")}</div></section>`);
}

await writeFile(new URL("../preview.html", import.meta.url), `<!doctype html><html><head><meta charset="utf-8"><title>Family Tree previews</title>
<style>
  body { margin: 0; padding: 20px; background: #6b6b6b; font: 14px system-ui, sans-serif; color: #fff; }
  h2 { font-size: 16px; margin: 24px 0 8px; } h2 small { font-weight: 400; opacity: .8; }
  .row { display: flex; gap: 16px; flex-wrap: wrap; }
  figure { margin: 0; } figcaption { margin-bottom: 4px; text-transform: uppercase; letter-spacing: .08em; font-size: 12px; }
  .frame { width: calc(800px * var(--scale)); height: calc(480px * var(--scale)); overflow: hidden; }
  iframe { border: 0; background: #fff; transform: scale(var(--scale)); transform-origin: 0 0; }
  :root { --scale: 0.6; } :root.full { --scale: 1; }
</style>
<script>if (location.hash === "#full") document.documentElement.classList.add("full");</script>
</head><body>${rows.join("\n")}</body></html>\n`);
console.log(`rendered ${sample.length} people x ${VARIANTS.length} variants (${fonts} fonts) to preview.html: ${sample.map((person) => person.id).join(", ")}`);

// One iframe reused for every render, so the page stays light enough for the shared
// browser. Each render reports clipped boxes, text the content limiter shrank, and
// anything that spills out of the layout box.
function auditPage(renders) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Family Tree audit</title></head>
<body><iframe id="frame" width="800" height="480" style="border:0"></iframe>
<script>
const renders = ${JSON.stringify(renders).replaceAll("</", "<\\/")};
window.audit = []; window.auditDone = false;
const frame = document.getElementById("frame");
const describe = (el) => el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\\s+/).join(".") : el.tagName.toLowerCase();
function measure(doc) {
  const issues = [];
  const bounds = doc.querySelector(".layout").getBoundingClientRect();
  for (const el of doc.querySelectorAll(".view *")) {
    const style = getComputedStyle(el);
    const clips = /hidden|clip/.test(style.overflowX + style.overflowY) || style.webkitLineClamp !== "none";
    if (clips && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)) {
      issues.push("clipped " + describe(el) + " " + el.scrollHeight + ">" + el.clientHeight);
    }
    const box = el.getBoundingClientRect();
    if (box.width && !el.children.length && (box.bottom > bounds.bottom + 0.5 || box.right > bounds.right + 0.5)) {
      issues.push("overflows " + describe(el));
    }
  }
  for (const el of doc.querySelectorAll(".content--small[data-content-limiter]")) issues.push("limited " + describe(el));
  return issues;
}
async function run() {
  for (const render of renders) {
    await new Promise((resolve) => { frame.onload = resolve; frame.srcdoc = render.html; });
    // Measuring before the webfonts load would wrap text in narrower fallback fonts.
    await frame.contentDocument.fonts.ready;
    await new Promise((resolve) => setTimeout(resolve, 120));
    const issues = measure(frame.contentDocument);
    window.audit.push({ id: render.id, variant: render.variant, issues });
  }
  window.auditDone = true;
}
run();
</script></body></html>
`;
}

// Average character width of each type style over the real text it sets, for both
// font families. The averages feed the METRICS table in src/pick.ts.
function calibratePage() {
  const corpus = {
    story: people.flatMap((person) => person.story).join(" "),
    names: people.map((person) => person.name).join(" "),
    facts: people.flatMap((person) => [person.born_place, ...person.lived, ...person.work, ...person.spouse, ...person.parents]).filter(Boolean).join(" "),
    relations: people.map((person) => person.relation).join(" "),
    labels: "Born Baptized Lived Places Work Married Partner Parents Roots Died Buried From Ann to Zach",
    dates: people.map((person) => person.lifespan).filter(Boolean).join(" "),
  };
  const styles = [
    ["label", "label label--small", "labels"], ["base", "text--base", "facts"], ["large", "text--large", "names"],
    ["titleSmall", "title title--small", "relations"], ["titleLarge", "title title--large text--bold", "names"],
    ["titleXlarge", "title title--xlarge text--bold", "names"], ["valueXsmall", "value value--xsmall", "dates"],
    ["valueSmall", "value value--small", "dates"], ["story xlarge", "content content--xlarge", "story"],
    ["story large", "content content--large", "story"], ["story base", "content content--base", "story"],
  ];
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://trmnl.com/css/${FRAMEWORK}/plugins.css"><style>html,body{margin:0}</style></head>
<body class="environment trmnl"><div id="screen" class="screen"><div class="view view--full"><div id="out" class="layout"></div></div></div>
<script>
const corpus = ${JSON.stringify(corpus).replaceAll("</", "<\\/")};
const styles = ${JSON.stringify(styles)};
window.calibration = null;
(async () => {
  const result = {};
  for (const fonts of ["classic", "trmnl"]) {
    document.getElementById("screen").className = "screen screen--2bit screen--ogv2 screen--md screen--1x screen--fonts-" + fonts + " screen--density-1x";
    const spans = styles.map(([name, className, source]) => {
      const span = document.createElement("span");
      span.className = className;
      span.style.cssText = "white-space:nowrap;display:inline-block";
      span.textContent = corpus[source];
      return [name, span, source];
    });
    document.getElementById("out").replaceChildren(...spans.map(([, span]) => span));
    // Fonts load only once text uses them.
    await document.fonts.ready;
    await new Promise((resolve) => setTimeout(resolve, 300));
    result[fonts] = Object.fromEntries(spans.map(([name, span, source]) => [name, +(span.getBoundingClientRect().width / corpus[source].length).toFixed(2)]));
  }
  window.calibration = result;
})();
</script></body></html>
`;
}
