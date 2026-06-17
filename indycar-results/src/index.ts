interface SeasonSession {
  EventsSessionID: string;
  SessionName: string;
}

interface SeasonEvent {
  EventID: number;
  EventName: string;
  Sessions: SeasonSession[] | null;
}

interface SeasonEntry {
  Year: string;
  Events: SeasonEvent[];
}

interface RaceRecord {
  DriverUrl: string | null;
  DriversID: number;
  FirstName: string;
  LastName: string;
  CarNumber: string;
  PositionStart: number | null;
  PositionFinish: number | null;
  ElapsedTime: string | null;
  LapsComplete: number | null;
  LapsDown: number | null;
  BestLapTime: string | null;
  Difference: string | null;
  SpeedAvgFormatted: string | null;
  BestSpeedFormatted: string | null;
  LapsLed: number | null;
  PitStops: number | null;
  Status: string | null;
  PointsEarned: number | null;
  DriverName: string;
  TeamName: string | null;
}

interface EventSessionDetails {
  EventName: string;
  SessionName: string;
  SessionDate: string;
  SessionDateFormatted: string;
  SessionType: string;
  TrackType: string;
  records: RaceRecord[];
}

const EASTERN_TIME_ZONE = "America/New_York";
const INDYCAR_SERIES_ID = "b856a4f1-e85c-4fac-8c36-fd58d962227a";
const RESULTS_API_BASE = "https://www.indycar.com/api/results";

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("OK", { status: 200 });
    }

    try {
      const selection = await selectLatestRaceResult();
      const race = selection.race;
      const results = race.records
        .slice()
        .sort((left, right) => Number(left.PositionFinish ?? 999) - Number(right.PositionFinish ?? 999));

      if (results.length === 0) {
        throw new Error("No race result records found");
      }

      const [p1, p2, p3] = results;

      if (!p1) {
        throw new Error("No podium data found");
      }

      const restResults = results.slice(3, 17).map((result) => {
        return {
          pos: String(result.PositionFinish ?? ""),
          name: result.DriverName,
          team: result.TeamName || "",
          gap: formatGap(result),
        };
      });

      const fastestLap = getFastestLap(results);
      const raceDate = parseOfficialDate(race.SessionDate) ?? parseOfficialDate(race.SessionDateFormatted);

      const mergeVariables = {
        season_year: selection.year,
        race_name: race.EventName,
        race_date: raceDate ? formatDate(raceDate) : race.SessionDateFormatted,
        round: `Round ${selection.round}`,
        track_type: formatTrackType(race.TrackType),
        field_size: results.length,
        winner_name: p1.DriverName,
        winner_team: p1.TeamName || "",
        winner_time: p1.ElapsedTime || "",
        winner_start: p1.PositionStart || "",
        winner_grid: p1.PositionStart || "",
        winner_laps: p1.LapsComplete || "",
        winner_points: p1.PointsEarned || "",
        winner_avg_speed: p1.SpeedAvgFormatted || "",
        p2_name: p2?.DriverName || "",
        p2_team: p2?.TeamName || "",
        p2_gap: p2 ? formatGap(p2) : "",
        p3_name: p3?.DriverName || "",
        p3_team: p3?.TeamName || "",
        p3_gap: p3 ? formatGap(p3) : "",
        fastest_lap_driver: fastestLap?.DriverName || "",
        fastest_lap_time: fastestLap?.BestLapTime || "",
        ...Object.fromEntries(
          Array.from({ length: 14 }, (_, i) => {
            const result = restResults[i];
            const n = i + 4;
            return [
              [`p${n}_pos`, result?.pos ?? ""],
              [`p${n}_name`, result?.name ?? ""],
              [`p${n}_team`, result?.team ?? ""],
              [`p${n}_gap`, result?.gap ?? ""],
            ];
          }).flat(),
        ),
      };

      if (url.pathname === "/api") {
        return jsonResponse({
          ...mergeVariables,
          raw: {
            season_year: selection.year,
            round: selection.round,
            event: selection.event,
            race,
          },
        });
      }
      return jsonResponse(mergeVariables);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("IndyCar Results error:", message);
      return errorResponse(message);
    }
  },
};

async function selectLatestRaceResult(): Promise<{
  year: number;
  round: number;
  event: SeasonEvent;
  race: EventSessionDetails;
}> {
  const currentYear = getEasternDateParts(new Date()).year;

  for (const year of [currentYear, currentYear - 1]) {
    const season = await fetchSeasonDropDown();
    const seasonEntry = season.find((entry) => Number(entry.Year) === year);

    if (!seasonEntry) continue;

    for (let index = 0; index < seasonEntry.Events.length; index += 1) {
      const event = seasonEntry.Events[index];
      const raceSession = event.Sessions?.find((session) => session.SessionName.toLowerCase() === "race");

      if (!raceSession) continue;

      const race = await fetchSessionDetails(raceSession.EventsSessionID);

      if (race.records?.length > 0) {
        return {
          year,
          round: seasonEntry.Events.length - index,
          event,
          race,
        };
      }
    }
  }

  throw new Error("No completed IndyCar race result found");
}

async function fetchSeasonDropDown(): Promise<SeasonEntry[]> {
  const res = await fetch(`${RESULTS_API_BASE}/SeasonDropDown?id=${INDYCAR_SERIES_ID}`);

  if (!res.ok) {
    throw new Error(`Season API returned ${res.status}`);
  }

  return (await res.json()) as SeasonEntry[];
}

async function fetchSessionDetails(sessionId: string): Promise<EventSessionDetails> {
  const res = await fetch(`${RESULTS_API_BASE}/EventsSessionDetails?id=${sessionId}`);

  if (!res.ok) {
    throw new Error(`Session API returned ${res.status}`);
  }

  return (await res.json()) as EventSessionDetails;
}

function formatGap(result: RaceRecord): string {
  if (result.PositionFinish === 1) {
    return result.ElapsedTime || "";
  }

  if (result.Difference && result.Difference !== "--.----") {
    return result.Difference.startsWith("+") ? result.Difference : `+${result.Difference}`;
  }

  if (result.LapsDown && result.LapsDown > 0) {
    return `-${result.LapsDown} ${result.LapsDown === 1 ? "lap" : "laps"}`;
  }

  return result.Status || "";
}

function getFastestLap(results: RaceRecord[]): RaceRecord | null {
  const candidates = results
    .filter((result) => result.BestLapTime)
    .map((result) => ({ result, seconds: parseLapTime(result.BestLapTime || "") }))
    .filter((entry) => entry.seconds !== null) as { result: RaceRecord; seconds: number }[];

  candidates.sort((left, right) => left.seconds - right.seconds);
  return candidates[0]?.result || null;
}

function parseLapTime(value: string): number | null {
  const parts = value.split(":").map(Number);

  if (parts.some((part) => Number.isNaN(part))) {
    return null;
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  return null;
}

function parseOfficialDate(value: string): Date | null {
  if (!value) return null;

  const numericMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (numericMatch) {
    const [, month, day, year] = numericMatch;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0));
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const match = value.match(/([A-Za-z]+),\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})/);
  if (!match) return null;

  const [, , monthName, day, year] = match;
  const month = monthIndex(monthName);
  if (month === null) return null;

  return new Date(Date.UTC(Number(year), month, Number(day), 12, 0, 0));
}

function monthIndex(monthName: string): number | null {
  const index = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ].indexOf(monthName.toLowerCase());

  return index >= 0 ? index : null;
}

function formatTrackType(value: string): string {
  if (value === "O") return "Oval";
  if (value === "R") return "Road";
  if (value === "S") return "Street";
  return value || "";
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

function getEasternDateParts(date: Date): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value ?? 0),
    month: Number(parts.find((part) => part.type === "month")?.value ?? 0),
    day: Number(parts.find((part) => part.type === "day")?.value ?? 0),
  };
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
