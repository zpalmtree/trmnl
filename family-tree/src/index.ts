import data from "./data/people.json";
import { parseVariant, pickPerson, toMergeVariables, type PersonCard, type Pool } from "./pick.ts";

interface Env {
  FEED_TOKEN?: string;
  ROTATE_MINUTES?: string;
  VARIANT?: string;
  POOL?: string;
}

const people = (data as { people: PersonCard[] }).people;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") return new Response("OK");
    if (url.pathname !== "/api") return new Response("Not found", { status: 404 });

    // Fail closed: the payload is private family history.
    if (!env.FEED_TOKEN || request.headers.get("Authorization") !== `Bearer ${env.FEED_TOKEN}`) {
      return json({ error: "unauthorized" }, 401);
    }

    const pool: Pool = (url.searchParams.get("pool") || env.POOL) === "story" ? "story" : "all";
    const person = pickPerson(people, {
      now: Date.now(),
      rotateMinutes: Number(env.ROTATE_MINUTES) || 60,
      pool,
      id: url.searchParams.get("id"),
    });
    if (!person) return json({ error: "no matching person" }, 404);

    const variant = parseVariant(url.searchParams.get("variant") || env.VARIANT, "sidebar");
    return json(toMergeVariables(person, variant));
  },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
