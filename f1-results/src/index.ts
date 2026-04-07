interface ApiDateTime {
  date: string | null;
  time: string | null;
}

type ScheduleEntry = string | ApiDateTime | null | undefined;

interface Driver {
  driverId: string;
  name: string;
  surname: string;
  nationality: string;
  birthday: string;
  number: number;
  shortName: string;
}

interface Team {
  teamId: string;
  teamName: string;
  country: string;
}

interface RaceResult {
  position: number | string;
  points: number | string;
  grid: number | string;
  laps: number | string;
  time: string;
  fastLap: string | null;
  driver: Driver;
  team: Team;
}

interface Circuit {
  circuitId: string;
  circuitName: string;
  country: string;
  city: string;
}

interface RaceData {
  round: number | string;
  date: string;
  time: string;
  raceName: string;
  circuit: Circuit | Circuit[];
  results: RaceResult[] | null;
}

interface RoundRaceResponse {
  season: number | string | null;
  races: RaceData | null;
}

interface SeasonRace {
  raceId: string;
  raceName: string;
  round: number;
  schedule: {
    race: ScheduleEntry;
  };
  winner?: unknown | null;
}

interface SeasonResponse {
  season: number;
  races: SeasonRace[];
}

const EASTERN_TIME_ZONE = "America/New_York";

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("OK", { status: 200 });
    }

    try {
      const selection = await selectLatestRaceResult();
      const race = selection.race;
      race.circuit = normalizeCircuit(race.circuit);
      const results = race.results ?? [];

      if (results.length === 0) {
        throw new Error("No race data found");
      }

      const top10 = results.slice(0, 10);
      const [p1, p2, p3] = top10;

      if (!p1) {
        throw new Error("No podium data found");
      }

      const raceDate = parseScheduleDate({ date: race.date, time: race.time });

      if (!raceDate) {
        throw new Error("Invalid race date");
      }

      const restResults = results.slice(3, 17).map((result) => {
        const gap = result.time.startsWith("+") ? result.time : (result.time === "DNF" ? "DNF" : result.time);
        return {
          pos: String(result.position),
          name: `${result.driver.name} ${result.driver.surname}`,
          gap,
        };
      });

      const fastestLap = results.find((result) => result.fastLap);

      const mergeVariables = {
        race_name: formatRaceName(race.raceName),
        circuit_name: race.circuit.circuitName,
        location: `${race.circuit.city}, ${race.circuit.country}`,
        race_date: formatDate(raceDate),
        round: `Round ${race.round}`,
        winner_name: `${p1.driver.name} ${p1.driver.surname}`,
        winner_short: p1.driver.shortName,
        winner_team: formatTeamName(p1.team.teamName),
        winner_time: p1.time,
        winner_grid: p1.grid,
        p2_name: p2 ? `${p2.driver.name} ${p2.driver.surname}` : "",
        p2_short: p2?.driver.shortName || "",
        p2_team: p2 ? formatTeamName(p2.team.teamName) : "",
        p2_gap: p2?.time || "",
        p3_name: p3 ? `${p3.driver.name} ${p3.driver.surname}` : "",
        p3_short: p3?.driver.shortName || "",
        p3_team: p3 ? formatTeamName(p3.team.teamName) : "",
        p3_gap: p3?.time || "",
        fastest_lap_driver: fastestLap?.driver.shortName || "",
        fastest_lap_time: fastestLap?.fastLap || "",
        ...Object.fromEntries(
          Array.from({ length: 14 }, (_, i) => {
            const r = restResults[i];
            const n = i + 4;
            return [
              [`p${n}_pos`, r?.pos ?? ""],
              [`p${n}_name`, r?.name ?? ""],
              [`p${n}_gap`, r?.gap ?? ""],
            ];
          }).flat(),
        ),
      };

      if (url.pathname === "/api") {
        return jsonResponse({
          ...mergeVariables,
          raw: {
            season: selection.season,
            round: selection.round,
            source: selection.source,
            race,
          },
        });
      }
      return jsonResponse(mergeVariables);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("F1 Results error:", message);
      return errorResponse(message);
    }
  },
};

async function selectLatestRaceResult(): Promise<{
  season: number;
  round: number;
  source: string;
  race: RaceData;
}> {
  const currentSeason = await fetchSeason("current");
  const currentRace = await findLatestCompletedRaceResult(
    currentSeason.season,
    currentSeason.races,
    "current-season-round-results",
  );

  if (currentRace) {
    return currentRace;
  }

  const previousSeasonNumber = currentSeason.season - 1;
  const previousSeason = await fetchSeason(previousSeasonNumber);
  const previousRace = await findLatestCompletedRaceResult(
    previousSeasonNumber,
    previousSeason.races,
    "previous-season-round-results",
  );

  if (previousRace) {
    return previousRace;
  }

  const fallbackRes = await fetch("https://f1api.dev/api/current/last/race");
  if (!fallbackRes.ok) {
    throw new Error(`API returned ${fallbackRes.status}`);
  }

  const fallbackData = (await fallbackRes.json()) as RoundRaceResponse;

  if (!hasResults(fallbackData.races)) {
    throw new Error("No completed race results found");
  }

  return {
    season: Number(fallbackData.season ?? currentSeason.season),
    round: Number(fallbackData.races.round),
    source: "fallback-current-last-race",
    race: fallbackData.races,
  };
}

async function fetchSeason(season: number | "current"): Promise<SeasonResponse> {
  const res = await fetch(`https://f1api.dev/api/${season}`);

  if (!res.ok) {
    throw new Error(`Season API returned ${res.status}`);
  }

  return (await res.json()) as SeasonResponse;
}

async function findLatestCompletedRaceResult(
  season: number,
  races: SeasonRace[],
  source: string,
): Promise<{
  season: number;
  round: number;
  source: string;
  race: RaceData;
} | null> {
  const completedRaces = races
    .filter((race) => race.winner)
    .sort((left, right) => right.round - left.round);

  for (const race of completedRaces) {
    const result = await fetchRoundRaceResult(season, race.round);

    if (hasResults(result.races)) {
      return {
        season,
        round: race.round,
        source,
        race: result.races,
      };
    }
  }

  return null;
}

async function fetchRoundRaceResult(season: number, round: number): Promise<RoundRaceResponse> {
  const res = await fetch(`https://f1api.dev/api/${season}/${round}/race`);

  if (!res.ok) {
    throw new Error(`Round API returned ${res.status}`);
  }

  return (await res.json()) as RoundRaceResponse;
}

function hasResults(race: RaceData | null): race is RaceData {
  return Boolean(race && Array.isArray(race.results) && race.results.length > 0);
}

function normalizeCircuit(circuit: Circuit | Circuit[]): Circuit {
  return Array.isArray(circuit) ? circuit[0] : circuit;
}

function parseScheduleDate(entry: ScheduleEntry): Date | null {
  if (!entry) return null;

  if (typeof entry === "string") {
    const parsed = new Date(entry);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (!entry.date) return null;

  const dateString = entry.time ? `${entry.date}T${entry.time}` : entry.date;
  const parsed = new Date(dateString);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRaceName(name: string): string {
  return name
    .replace(" Grand Prix", " GP")
    .replace(/^Formula 1\s+/i, "")
    .replace(/\s+\d{4}$/, "")
    .trim();
}

function formatTeamName(name: string): string {
  return name
    .replace(" Formula 1 Team", "")
    .replace(" Racing", "")
    .replace(" F1 Team", "")
    .replace("Scuderia ", "");
}

function jsonResponse(data: object): Response {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function errorResponse(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 500,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
