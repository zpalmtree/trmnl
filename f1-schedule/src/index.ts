interface Env {
  SEASON_START_FALLBACK: string;
}

interface ApiDateTime {
  date: string | null;
  time: string | null;
}

type ScheduleEntry = string | ApiDateTime | null | undefined;

interface Race {
  raceId: string;
  raceName: string;
  schedule: {
    race: ScheduleEntry;
    qualy?: ScheduleEntry;
    fp1?: ScheduleEntry;
    fp2?: ScheduleEntry;
    fp3?: ScheduleEntry;
    sprintQualy?: ScheduleEntry;
    sprint?: ScheduleEntry;
    sprintRace?: ScheduleEntry;
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
  race?: Race | Race[];
  races?: Race[];
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
        const race = getFirstRace(data);
        const raceDate = parseScheduleDate(race?.schedule.race);
        const qualyDate = parseScheduleDate(race?.schedule.qualy);
        const sprintDate = parseScheduleDate(race?.schedule.sprintRace ?? race?.schedule.sprint);

        if (race && raceDate) {
          const now = getEasternDate();
          const daysUntil = Math.ceil(
            (raceDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );

          const mergeVariables = {
            is_offseason: "false",
            race_name: formatRaceName(race.raceName),
            circuit_name: race.circuit?.circuitName || "",
            location: [race.circuit?.city, race.circuit?.country].filter(Boolean).join(", "),
            race_date: formatDate(getScheduleDisplayDate(raceDate)),
            race_time: formatTime(raceDate),
            days_until: daysUntil,
            days_label: daysUntil === 1 ? "day" : "days",
            round: race.round ? `Round ${race.round}` : "",
            laps: race.laps || "",
            quali_date: qualyDate ? formatDateTime(qualyDate) : "",
            has_sprint: sprintDate ? "true" : "false",
            sprint_date: sprintDate ? formatDateTime(sprintDate) : "",
            inseason_display: "block",
            offseason_display: "none",
            sprint_row_display: sprintDate ? "block" : "none",
            sprint_none_display: sprintDate ? "none" : "block",
            instance_label: race.round ? `Round ${race.round}` : "Next Race",
          };

          if (url.pathname === "/api") {
            return jsonResponse({ ...mergeVariables, raw: data });
          }
          return jsonResponse(mergeVariables);
        }
      }

      // Off-season - show countdown to next season
      const championshipRes = await fetch("https://f1api.dev/api/current/drivers-championship");

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

      const fallbackDate = parseScheduleDate(env.SEASON_START_FALLBACK)
        ?? new Date("2026-03-08T05:00:00Z");
      const fallbackRaceName = "Australian GP";
      const fallbackRaceLocation = "Melbourne, Australia";

      let seasonStartDate = fallbackDate;
      let firstRaceName = fallbackRaceName;
      let firstRaceLocation = fallbackRaceLocation;

      const nextSeasonRes = await fetch(`https://f1api.dev/api/${nextSeasonYear}`);
      if (nextSeasonRes.ok) {
        const seasonData = (await nextSeasonRes.json()) as SeasonResponse;
        const firstRace = getFirstRace(seasonData);
        const firstRaceDate = parseScheduleDate(firstRace?.schedule.race);

        if (firstRace && firstRaceDate) {
          seasonStartDate = firstRaceDate;
          firstRaceName = formatRaceName(firstRace.raceName);
          firstRaceLocation = [firstRace.circuit?.city, firstRace.circuit?.country].filter(Boolean).join(", ");
        }
      }

      const now = getEasternDate();
      const daysUntilSeason = Math.ceil(
        (seasonStartDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      const safeDaysUntilSeason = Math.max(0, daysUntilSeason);

      const mergeVariables = {
        is_offseason: "true",
        season_year: nextSeasonYear,
        days_until: safeDaysUntilSeason,
        days_label: safeDaysUntilSeason === 1 ? "day" : "days",
        first_race_name: firstRaceName,
        first_race_location: firstRaceLocation,
        first_race_date: formatDate(seasonStartDate),
        champion_name: champion.name,
        champion_team: champion.team,
        champion_points: champion.points,
        champion_wins: champion.wins,
        last_season: lastSeason,
        inseason_display: "none",
        offseason_display: "block",
        sprint_row_display: "none",
        sprint_none_display: "none",
        instance_label: "Off-Season",
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

function getFirstRace(data: RaceResponse | SeasonResponse): Race | null {
  if (Array.isArray(data.race)) {
    return data.race[0] || null;
  }

  if (data.race) {
    return data.race;
  }

  if (Array.isArray(data.races)) {
    return data.races[0] || null;
  }

  return null;
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

function getEasternDate(): Date {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
}

function formatRaceName(name: string): string {
  return name.replace(" Grand Prix", " GP").replace(/^Formula 1\s+/i, "");
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(date: Date): string {
  const { hours, minutes } = getEasternTimeParts(date);

  if (hours === 0 && minutes === 0) return "Midnight";
  if (hours === 12 && minutes === 0) return "Noon";

  return date.toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateTime(date: Date): string {
  return `${formatDate(getScheduleDisplayDate(date))} · ${formatTime(date)}`;
}

function getScheduleDisplayDate(date: Date): Date {
  const { hours, minutes } = getEasternTimeParts(date);
  if (hours === 0 && minutes === 0) {
    return new Date(date.getTime() - 24 * 60 * 60 * 1000);
  }
  return date;
}

function getEasternTimeParts(date: Date): { hours: number; minutes: number } {
  const easternDate = new Date(date.toLocaleString("en-US", { timeZone: "America/New_York" }));
  return {
    hours: easternDate.getHours(),
    minutes: easternDate.getMinutes(),
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
