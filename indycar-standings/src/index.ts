interface PointsEntry {
  Track: string;
  TrackType: string | null;
  EventsSessionsID: number;
  Points: number;
}

interface DriverStanding {
  DriverName: string;
  Rookie: string | null;
  OverallPosition: number;
  TotalPoints: number;
  OvalPoints: number;
  RoadPoints: number;
  TotalWins: number;
  TotalPoles: number;
  TotalTop5s: number;
  BestFinish: number;
  Points: PointsEntry[];
}

interface YearPointSummary {
  Year: number;
  SeriesTitle: string;
  SortTitle: string;
  UpdatedDate: string;
  DriverList: DriverStanding[];
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
      const data = await fetchLatestStandings();
      const drivers = data.DriverList
        .slice()
        .sort((left, right) => left.OverallPosition - right.OverallPosition)
        .slice(0, 10);

      const [p1, p2, p3] = drivers;

      if (!p1) {
        throw new Error("No championship standings found");
      }

      const standingsList = drivers
        .map((driver) => {
          return `${driver.OverallPosition}. ${driver.DriverName} - ${driver.TotalPoints} pts`;
        })
        .join("\n");

      const mergeVariables = {
        season_year: data.Year,
        series_title: data.SeriesTitle,
        updated_date: formatUpdatedDate(data.UpdatedDate),
        standings_list: standingsList,
        races_completed: countCompletedRaces(data.DriverList),
        leader_position: "1",
        leader_name: p1.DriverName,
        leader_team: formatStatLine(p1),
        leader_points: p1.TotalPoints,
        leader_wins: p1.TotalWins,
        leader_poles: p1.TotalPoles,
        leader_top5s: p1.TotalTop5s,
        leader_best_finish: p1.BestFinish,
        leader_road_points: p1.RoadPoints,
        leader_oval_points: p1.OvalPoints,
        p2_name: p2?.DriverName || "",
        p2_team: p2 ? formatStatLine(p2) : "",
        p2_points: p2?.TotalPoints || 0,
        p2_gap: p2 ? p1.TotalPoints - p2.TotalPoints : 0,
        p2_wins: p2?.TotalWins || 0,
        p2_poles: p2?.TotalPoles || 0,
        p3_name: p3?.DriverName || "",
        p3_team: p3 ? formatStatLine(p3) : "",
        p3_points: p3?.TotalPoints || 0,
        p3_gap: p3 ? p1.TotalPoints - p3.TotalPoints : 0,
        p3_wins: p3?.TotalWins || 0,
        p3_poles: p3?.TotalPoles || 0,
        ...Object.fromEntries(
          Array.from({ length: 7 }, (_, index) => {
            const driver = formatDriverLine(drivers[index + 3]);
            const position = index + 4;
            return [
              [`p${position}_pos`, driver?.pos || ""],
              [`p${position}_name`, driver?.name || ""],
              [`p${position}_pts`, driver?.pts || 0],
              [`p${position}_wins`, driver?.wins || 0],
              [`p${position}_poles`, driver?.poles || 0],
            ];
          }).flat(),
        ),
      };

      if (url.pathname === "/api") {
        return jsonResponse({ ...mergeVariables, raw: data });
      }
      return jsonResponse(mergeVariables);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("IndyCar Standings error:", message);
      return errorResponse(message);
    }
  },
};

async function fetchLatestStandings(): Promise<YearPointSummary> {
  const currentYear = getEasternDateParts(new Date()).year;

  for (const year of [currentYear, currentYear - 1]) {
    const data = await fetchStandings(year);
    if (data.DriverList?.length > 0) {
      return data;
    }
  }

  throw new Error("No current or previous season standings found");
}

async function fetchStandings(year: number): Promise<YearPointSummary> {
  const res = await fetch(`${RESULTS_API_BASE}/YearPointSummary?year=${year}&id=${INDYCAR_SERIES_ID}`);

  if (!res.ok) {
    throw new Error(`Standings API returned ${res.status}`);
  }

  return (await res.json()) as YearPointSummary;
}

function countCompletedRaces(drivers: DriverStanding[]): number {
  const completedSessionIds = new Set<number>();

  for (const driver of drivers) {
    for (const points of driver.Points ?? []) {
      if (points.Track !== "Total" && points.EventsSessionsID !== 0 && points.Points > 0) {
        completedSessionIds.add(points.EventsSessionsID);
      }
    }
  }

  return completedSessionIds.size;
}

function formatDriverLine(
  driver: DriverStanding | undefined,
): { pos: string; name: string; pts: number; wins: number; poles: number } | null {
  if (!driver) return null;
  return {
    pos: String(driver.OverallPosition),
    name: driver.DriverName,
    pts: driver.TotalPoints,
    wins: driver.TotalWins,
    poles: driver.TotalPoles,
  };
}

function formatStatLine(driver: DriverStanding): string {
  return `${driver.TotalWins} wins · ${driver.TotalPoles} poles · ${driver.TotalTop5s} top 5`;
}

function formatUpdatedDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("en-US", {
    timeZone: EASTERN_TIME_ZONE,
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
