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
  position: number;
  points: number;
  grid: number;
  laps: number;
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
  round: number;
  date: string;
  time: string;
  raceName: string;
  circuit: Circuit;
  results: RaceResult[];
}

interface RaceResponse {
  season: number;
  races: RaceData;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("OK", { status: 200 });
    }

    try {
      const res = await fetch("https://f1api.dev/api/current/last/race");

      if (!res.ok) {
        throw new Error(`API returned ${res.status}`);
      }

      const data = (await res.json()) as RaceResponse;
      const race = data.races;

      if (!race || !race.results) {
        throw new Error("No race data found");
      }

      const results = race.results;
      const top10 = results.slice(0, 10);
      const [p1, p2, p3] = top10;

      const raceDate = new Date(`${race.date}T${race.time}`);

      // Calculate gaps from winner time for display
      const restResults = top10.slice(3).map((r) => {
        const gap = r.time.startsWith("+") ? r.time : (r.time === "DNF" ? "DNF" : "");
        return `${r.position}. ${r.driver.shortName} · ${gap || r.time}`;
      });

      const mergeVariables = {
        race_name: race.raceName.replace(" Grand Prix", " GP").replace(/\d{4}$/, "").trim(),
        circuit_name: race.circuit.circuitName,
        location: `${race.circuit.city}, ${race.circuit.country}`,
        race_date: formatDate(raceDate),
        round: `Round ${race.round}`,
        // Winner
        winner_name: `${p1.driver.name} ${p1.driver.surname}`,
        winner_short: p1.driver.shortName,
        winner_team: formatTeamName(p1.team.teamName),
        winner_time: p1.time,
        winner_grid: p1.grid,
        // P2
        p2_name: p2 ? `${p2.driver.name} ${p2.driver.surname}` : "",
        p2_short: p2?.driver.shortName || "",
        p2_team: p2 ? formatTeamName(p2.team.teamName) : "",
        p2_gap: p2?.time || "",
        // P3
        p3_name: p3 ? `${p3.driver.name} ${p3.driver.surname}` : "",
        p3_short: p3?.driver.shortName || "",
        p3_team: p3 ? formatTeamName(p3.team.teamName) : "",
        p3_gap: p3?.time || "",
        // Fastest lap
        fastest_lap_driver: top10.find((r) => r.fastLap)?.driver.shortName || "",
        fastest_lap_time: top10.find((r) => r.fastLap)?.fastLap || "",
        // Rest of top 10
        p4_line: restResults[0] || "",
        p5_line: restResults[1] || "",
        p6_line: restResults[2] || "",
        p7_line: restResults[3] || "",
        p8_line: restResults[4] || "",
        p9_line: restResults[5] || "",
        p10_line: restResults[6] || "",
      };

      if (url.pathname === "/api") {
        return jsonResponse({ ...mergeVariables, raw: data });
      }
      return jsonResponse(mergeVariables);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("F1 Results error:", message);
      return errorResponse(message);
    }
  },
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
