#!/usr/bin/env node
// Renders every layout variant for a sample of people into preview.html, so copy and
// layout can be compared side by side at the device's real 800x480 size.
//
//   npm run preview                       # default sample across story lengths
//   npm run preview -- --ids a,b,c        # specific people
//   npm run preview -- --all --offset 40  # everyone, 40 people per page
//
// Keep pages to ~40 people: hundreds of framework iframes outlast the shared browser
// bridge's 45s tool timeout and drop the session's Playwright connection.

import { readFile, writeFile } from "node:fs/promises";
import { Liquid } from "liquidjs";
import { VARIANTS, toMergeVariables } from "../src/pick.ts";

const FRAMEWORK = "3.4.0";
const args = process.argv.slice(2);
const option = (name) => args[args.indexOf(name) + 1];

const { people } = JSON.parse(await readFile(new URL("../src/data/people.json", import.meta.url), "utf8"));
const markup = await readFile(new URL("../src/markup.html", import.meta.url), "utf8");
const liquid = new Liquid({ strictFilters: true });

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
const sample = args.includes("--all") ? people.slice(offset, offset + PAGE_SIZE)
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
<body class="environment trmnl"><div class="screen screen--ogv2"><div class="view view--full">${body}</div></div></body></html>`;

const rows = [];
for (const person of sample) {
  const cells = [];
  for (const variant of VARIANTS) {
    const body = await liquid.parseAndRender(markup, toMergeVariables(person, variant));
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
console.log(`rendered ${sample.length} people x ${VARIANTS.length} variants to preview.html: ${sample.map((person) => person.id).join(", ")}`);
