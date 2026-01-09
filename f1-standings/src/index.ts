interface ChampionshipDriver {
  position: number;
  points: number;
  wins: number;
  driver: {
    name: string;
    surname: string;
    shortName: string;
  };
  team: {
    teamName: string;
  };
}

interface ChampionshipResponse {
  season: number;
  drivers_championship: ChampionshipDriver[];
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("OK", { status: 200 });
    }

    try {
      const res = await fetch("https://f1api.dev/api/current/drivers-championship");

      if (!res.ok) {
        throw new Error(`API returned ${res.status}`);
      }

      const data = (await res.json()) as ChampionshipResponse;
      const drivers = data.drivers_championship.slice(0, 10);

      // Format standings for display
      const standingsList = drivers
        .map((d) => {
          const name = `${d.driver.shortName}`;
          const team = formatTeamName(d.team.teamName);
          return `${d.position}. ${name} (${team}) - ${d.points} pts`;
        })
        .join("\n");

      // Top 3 for featured display
      const [p1, p2, p3] = drivers;

      const mergeVariables = {
        season_year: data.season,
        standings_list: standingsList,
        // Leader details
        leader_position: "1",
        leader_name: `${p1.driver.name} ${p1.driver.surname}`,
        leader_short: p1.driver.shortName,
        leader_team: formatTeamName(p1.team.teamName),
        leader_points: p1.points,
        leader_wins: p1.wins,
        // P2 details
        p2_name: p2 ? `${p2.driver.name} ${p2.driver.surname}` : "",
        p2_short: p2?.driver.shortName || "",
        p2_team: p2 ? formatTeamName(p2.team.teamName) : "",
        p2_points: p2?.points || 0,
        p2_gap: p2 ? p1.points - p2.points : 0,
        // P3 details
        p3_name: p3 ? `${p3.driver.name} ${p3.driver.surname}` : "",
        p3_short: p3?.driver.shortName || "",
        p3_team: p3 ? formatTeamName(p3.team.teamName) : "",
        p3_points: p3?.points || 0,
        p3_gap: p3 ? p1.points - p3.points : 0,
        // Full top 10 formatted
        p4_pos: formatDriverLine(drivers[3])?.pos || "",
        p4_name: formatDriverLine(drivers[3])?.name || "",
        p4_pts: formatDriverLine(drivers[3])?.pts || 0,
        p5_pos: formatDriverLine(drivers[4])?.pos || "",
        p5_name: formatDriverLine(drivers[4])?.name || "",
        p5_pts: formatDriverLine(drivers[4])?.pts || 0,
        p6_pos: formatDriverLine(drivers[5])?.pos || "",
        p6_name: formatDriverLine(drivers[5])?.name || "",
        p6_pts: formatDriverLine(drivers[5])?.pts || 0,
        p7_pos: formatDriverLine(drivers[6])?.pos || "",
        p7_name: formatDriverLine(drivers[6])?.name || "",
        p7_pts: formatDriverLine(drivers[6])?.pts || 0,
        p8_pos: formatDriverLine(drivers[7])?.pos || "",
        p8_name: formatDriverLine(drivers[7])?.name || "",
        p8_pts: formatDriverLine(drivers[7])?.pts || 0,
        p9_pos: formatDriverLine(drivers[8])?.pos || "",
        p9_name: formatDriverLine(drivers[8])?.name || "",
        p9_pts: formatDriverLine(drivers[8])?.pts || 0,
        p10_pos: formatDriverLine(drivers[9])?.pos || "",
        p10_name: formatDriverLine(drivers[9])?.name || "",
        p10_pts: formatDriverLine(drivers[9])?.pts || 0,
      };

      if (url.pathname === "/api") {
        return jsonResponse({ ...mergeVariables, raw: data });
      }
      return jsonResponse(mergeVariables);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("F1 Standings error:", message);
      return errorResponse(message);
    }
  },
};

function formatTeamName(name: string): string {
  return name
    .replace(" Formula 1 Team", "")
    .replace(" Racing", "")
    .replace(" F1 Team", "")
    .replace("Scuderia ", "");
}

function formatDriverLine(driver: ChampionshipDriver | undefined): { pos: string; name: string; pts: number } | null {
  if (!driver) return null;
  return {
    pos: String(driver.position),
    name: `${driver.driver.name} ${driver.driver.surname}`,
    pts: driver.points,
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
