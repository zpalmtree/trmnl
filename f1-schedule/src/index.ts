interface Env {
  SEASON_START_FALLBACK: string;
}

interface Race {
  raceId: string;
  raceName: string;
  schedule: {
    race: string;
    qualy?: string;
    fp1?: string;
    fp2?: string;
    fp3?: string;
    sprintQualy?: string;
    sprint?: string;
  };
  laps: number;
  round: number;
  circuit: {
    circuitName: string;
    country: string;
    city: string;
  };
}

interface RaceResponse {
  race: Race;
}

interface SeasonResponse {
  season: number;
  races: Race[];
}

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
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("OK", { status: 200 });
    }

    try {
      // Try to get next race
      const nextRaceRes = await fetch("https://f1api.dev/api/current/next");

      if (nextRaceRes.ok) {
        // Active season - show next race
        const data = (await nextRaceRes.json()) as RaceResponse;
        const race = data.race;

        const raceDate = new Date(race.schedule.race);
        const now = new Date();
        const daysUntil = Math.ceil(
          (raceDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        const mergeVariables = {
          is_offseason: "false",
          race_name: race.raceName.replace(" Grand Prix", " GP"),
          circuit_name: race.circuit.circuitName,
          location: `${race.circuit.city}, ${race.circuit.country}`,
          race_date: formatDate(raceDate),
          race_time: formatTime(raceDate),
          days_until: daysUntil,
          days_label: daysUntil === 1 ? "day" : "days",
          round: `Round ${race.round}`,
          laps: race.laps,
          quali_date: race.schedule.qualy ? formatDateTime(new Date(race.schedule.qualy)) : "",
          has_sprint: race.schedule.sprint ? "true" : "false",
          sprint_date: race.schedule.sprint ? formatDateTime(new Date(race.schedule.sprint)) : "",
        };

        if (url.pathname === "/api") {
          return jsonResponse({ ...mergeVariables, raw: data });
        }
        return jsonResponse(mergeVariables);
      }

      // Off-season - show countdown to next season
      const [championshipRes, lastRaceRes] = await Promise.all([
        fetch("https://f1api.dev/api/current/drivers-championship"),
        fetch("https://f1api.dev/api/current/last"),
      ]);

      let champion = { name: "TBD", points: 0, wins: 0, team: "" };
      let lastSeason = new Date().getFullYear();

      if (championshipRes.ok) {
        const champData = (await championshipRes.json()) as ChampionshipResponse;
        lastSeason = champData.season;
        const leader = champData.drivers_championship[0];
        if (leader) {
          champion = {
            name: `${leader.driver.name} ${leader.driver.surname}`,
            points: leader.points,
            wins: leader.wins,
            team: leader.team.teamName.replace(" Formula 1 Team", "").replace(" Racing", ""),
          };
        }
      }

      // Try to get first race of next season
      const nextSeasonYear = lastSeason + 1;

      // 2026 fallback data (APIs don't have it yet)
      const fallback2026 = {
        date: "2026-03-08T05:00:00Z",
        name: "Australian GP",
        location: "Melbourne, Australia",
      };

      let seasonStartDate = new Date(fallback2026.date);
      let firstRaceName = fallback2026.name;
      let firstRaceLocation = fallback2026.location;

      const nextSeasonRes = await fetch(`https://f1api.dev/api/${nextSeasonYear}`);
      if (nextSeasonRes.ok) {
        const seasonData = (await nextSeasonRes.json()) as SeasonResponse;
        if (seasonData.races && seasonData.races.length > 0) {
          const firstRace = seasonData.races[0];
          seasonStartDate = new Date(firstRace.schedule.race);
          firstRaceName = firstRace.raceName.replace(" Grand Prix", " GP");
          firstRaceLocation = `${firstRace.circuit.city}, ${firstRace.circuit.country}`;
        }
      }

      const now = new Date();
      const daysUntilSeason = Math.ceil(
        (seasonStartDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      const mergeVariables = {
        is_offseason: "true",
        season_year: nextSeasonYear,
        days_until: Math.max(0, daysUntilSeason),
        days_label: daysUntilSeason === 1 ? "day" : "days",
        first_race_name: firstRaceName,
        first_race_location: firstRaceLocation,
        first_race_date: formatDate(seasonStartDate),
        champion_name: champion.name,
        champion_team: champion.team,
        champion_points: champion.points,
        champion_wins: champion.wins,
        last_season: lastSeason,
      };

      if (url.pathname === "/api") {
        return jsonResponse({ ...mergeVariables, raw: { champion } });
      }
      return jsonResponse(mergeVariables);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("F1 Schedule error:", message);
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
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function formatDateTime(date: Date): string {
  return `${formatDate(date)} ${formatTime(date)}`;
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
