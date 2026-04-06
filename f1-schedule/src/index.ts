interface Env {
  SEASON_START_FALLBACK: string;
  HIDDEN_RACE_IDS?: string;
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
  winner?: unknown | null;
  teamWinner?: unknown | null;
  status?: string | null;
  cancelled?: boolean | null;
  canceled?: boolean | null;
  isCancelled?: boolean | null;
  isCanceled?: boolean | null;
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

type CountdownTargetLabel = "Qualifying" | "Sprint Qualifying" | "Sprint" | "Race";

type SessionKey = "sprint_qualy" | "qualy" | "sprint" | "race";

interface CountdownTarget {
  key: SessionKey;
  label: CountdownTargetLabel;
  date: Date;
}

interface RaceSelection {
  race: Race;
  raceDate: Date;
  qualyDate: Date | null;
  sprintQualyDate: Date | null;
  sprintDate: Date | null;
  sessions: CountdownTarget[];
  countdownTarget: CountdownTarget;
  isToday: boolean;
}

const EASTERN_TIME_ZONE = "America/New_York";
const DAY_IN_MS = 1000 * 60 * 60 * 24;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("OK", { status: 200 });
    }

    try {
      const hiddenRaceIds = getHiddenRaceIds(env.HIDDEN_RACE_IDS);
      const now = new Date();

      const currentSeasonRes = await fetch("https://f1api.dev/api/current");

      if (currentSeasonRes.ok) {
        const seasonData = (await currentSeasonRes.json()) as SeasonResponse;
        const visibleRaces = seasonData.races.filter((race) => !isRaceCancelled(race, hiddenRaceIds));
        const selection = getCurrentRaceSelection(visibleRaces, now);

        if (selection) {
          const daysUntil = selection.isToday
            ? 0
            : Math.max(0, getEasternDayDifference(now, selection.countdownTarget.date));
          const scheduleLayout = getScheduleLayoutVariables(selection);

          const mergeVariables = {
            is_offseason: "false",
            race_name: formatRaceName(selection.race.raceName),
            circuit_name: selection.race.circuit?.circuitName || "",
            location: [selection.race.circuit?.city, selection.race.circuit?.country].filter(Boolean).join(", "),
            race_date: formatDate(getScheduleDisplayDate(selection.raceDate)),
            race_time: formatTime(selection.raceDate),
            days_until: selection.isToday ? "Today" : String(daysUntil),
            days_label: selection.isToday ? "" : daysUntil === 1 ? "day" : "days",
            countdown_value: selection.isToday ? "Today" : String(daysUntil),
            countdown_note: selection.isToday ? "Race weekend" : daysUntil === 1 ? "day to go" : "days to go",
            countdown_value_size: selection.isToday
              ? (selection.sessions.length >= 4 ? "4.4rem" : "4.8rem")
              : (selection.sessions.length >= 4 ? "6.4rem" : "7rem"),
            countdown_note_size: selection.sessions.length >= 4 ? "1.15rem" : "1.3rem",
            countdown_note_margin_top: selection.sessions.length >= 4 ? "4px" : "8px",
            round: selection.race.round ? `Round ${selection.race.round}` : "",
            laps: selection.race.laps || "",
            quali_date: selection.qualyDate ? formatDateTime(selection.qualyDate) : "",
            sprint_qualy_date: selection.sprintQualyDate ? formatDateTime(selection.sprintQualyDate) : "",
            has_sprint: selection.sprintDate ? "true" : "false",
            sprint_date: selection.sprintDate ? formatDateTime(selection.sprintDate) : "",
            inseason_display: "block",
            offseason_display: "none",
            sprint_qualy_row_display: selection.sprintQualyDate ? "block" : "none",
            sprint_row_display: selection.sprintDate ? "block" : "none",
            sprint_none_display: selection.sprintDate ? "none" : "block",
            instance_label: selection.race.laps ? `${selection.race.laps} laps` : "",
            ...scheduleLayout,
          };

          if (url.pathname === "/api") {
            return jsonResponse({
              ...mergeVariables,
              raw: {
                season: seasonData,
                hidden_race_ids: Array.from(hiddenRaceIds),
                selection: {
                  race_id: selection.race.raceId,
                  countdown_target: {
                    label: selection.countdownTarget.label,
                    date: selection.countdownTarget.date.toISOString(),
                  },
                  is_today: selection.isToday,
                },
              },
            });
          }
          return jsonResponse(mergeVariables);
        }
      }

      const championshipRes = await fetch("https://f1api.dev/api/current/drivers-championship");

      let champion = { name: "TBD", points: 0, wins: 0, team: "" };
      let lastSeason = getEasternDateParts(now).year;

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
        const firstRace = seasonData.races.find((race) => !isRaceCancelled(race, hiddenRaceIds));
        const firstRaceDate = parseScheduleDate(firstRace?.schedule.race);

        if (firstRace && firstRaceDate) {
          seasonStartDate = firstRaceDate;
          firstRaceName = formatRaceName(firstRace.raceName);
          firstRaceLocation = [firstRace.circuit?.city, firstRace.circuit?.country].filter(Boolean).join(", ");
        }
      }

      const safeDaysUntilSeason = Math.max(0, getEasternDayDifference(now, seasonStartDate));

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
        sprint_qualy_row_display: "none",
        sprint_row_display: "none",
        sprint_none_display: "none",
        instance_label: "Off-Season",
      };

      if (url.pathname === "/api") {
        return jsonResponse({
          ...mergeVariables,
          raw: {
            champion,
            hidden_race_ids: Array.from(hiddenRaceIds),
          },
        });
      }
      return jsonResponse(mergeVariables);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("F1 Schedule error:", message);
      return errorResponse(message);
    }
  },
};

function getCurrentRaceSelection(races: Race[], now: Date): RaceSelection | null {
  const prepared = races
    .map((race) => buildRaceSelection(race))
    .filter((race): race is RaceSelection => race !== null);

  if (prepared.length === 0) {
    return null;
  }

  const nowDay = getEasternDayNumber(now);
  const firstSeasonDay = getEasternDayNumber(prepared[0].countdownTarget.date);
  const lastSeasonDay = getEasternDayNumber(prepared[prepared.length - 1].raceDate);

  if (nowDay < firstSeasonDay || nowDay > lastSeasonDay) {
    return null;
  }

  const liveWeekend = prepared.find((race) => isRaceWeekendActive(race, nowDay));
  if (liveWeekend) {
    return { ...liveWeekend, isToday: true };
  }

  const nextRace = prepared.find((race) => getEasternDayNumber(race.countdownTarget.date) > nowDay);
  if (!nextRace) {
    return null;
  }

  return { ...nextRace, isToday: false };
}

function buildRaceSelection(race: Race): RaceSelection | null {
  const raceDate = parseScheduleDate(race.schedule.race);

  if (!raceDate) {
    return null;
  }

  const qualyDate = parseScheduleDate(race.schedule.qualy);
  const sprintQualyDate = parseScheduleDate(race.schedule.sprintQualy);
  const sprintDate = parseScheduleDate(race.schedule.sprintRace ?? race.schedule.sprint);
  const sessions = getWeekendSessions(raceDate, qualyDate, sprintQualyDate, sprintDate);
  const countdownTarget = sessions[0] ?? null;

  if (!countdownTarget) {
    return null;
  }

  return {
    race,
    raceDate,
    qualyDate,
    sprintQualyDate,
    sprintDate,
    sessions,
    countdownTarget,
    isToday: false,
  };
}

function getWeekendSessions(
  raceDate: Date,
  qualyDate: Date | null,
  sprintQualyDate: Date | null,
  sprintDate: Date | null,
): CountdownTarget[] {
  const targets: CountdownTarget[] = [
    { key: "race", label: "Race", date: raceDate },
  ];

  if (qualyDate) {
    targets.push({ key: "qualy", label: "Qualifying", date: qualyDate });
  }

  if (sprintQualyDate) {
    targets.push({ key: "sprint_qualy", label: "Sprint Qualifying", date: sprintQualyDate });
  }

  if (sprintDate) {
    targets.push({ key: "sprint", label: "Sprint", date: sprintDate });
  }

  targets.sort((left, right) => left.date.getTime() - right.date.getTime());
  return targets;
}

function isRaceWeekendActive(race: RaceSelection, nowDay: number): boolean {
  const weekendStartDay = getEasternDayNumber(race.countdownTarget.date);
  const raceDay = getEasternDayNumber(race.raceDate);

  return nowDay >= weekendStartDay && nowDay <= raceDay;
}

function getScheduleLayoutVariables(selection: RaceSelection): Record<string, string> {
  const defaultOrder = selection.sessions.length + 2;
  const orderMap: Record<SessionKey, number> = {
    sprint_qualy: defaultOrder,
    qualy: defaultOrder,
    sprint: defaultOrder,
    race: defaultOrder,
  };

  selection.sessions.forEach((session, index) => {
    orderMap[session.key] = index + 1;
  });

  const isCompact = selection.sessions.length >= 4;

  return {
    sprint_qualy_order: String(orderMap.sprint_qualy),
    qualy_order: String(orderMap.qualy),
    sprint_order: String(orderMap.sprint),
    race_order: String(orderMap.race),
    sprint_none_order: String(selection.sessions.length + 1),
    schedule_row_padding: isCompact ? "8px 12px" : "12px 12px",
    schedule_label_font_size: isCompact ? "0.88rem" : "0.95rem",
    schedule_date_font_size: isCompact ? "1rem" : "1.1rem",
    schedule_race_date_font_size: isCompact ? "1.06rem" : "1.2rem",
  };
}

function getHiddenRaceIds(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((raceId) => raceId.trim())
      .filter(Boolean),
  );
}

function isRaceCancelled(race: Race, hiddenRaceIds: Set<string>): boolean {
  if (hiddenRaceIds.has(race.raceId)) {
    return true;
  }

  if (
    race.cancelled === true
    || race.canceled === true
    || race.isCancelled === true
    || race.isCanceled === true
  ) {
    return true;
  }

  return typeof race.status === "string" && race.status.toLowerCase().includes("cancel");
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

function formatRaceName(name: string): string {
  return name
    .replace(" Grand Prix", " GP")
    .replace(/^Formula 1\s+/i, "")
    .replace(/\s+\d{4}$/, "")
    .trim();
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    timeZone: EASTERN_TIME_ZONE,
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
    timeZone: EASTERN_TIME_ZONE,
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
    return new Date(date.getTime() - DAY_IN_MS);
  }
  return date;
}

function getEasternTimeParts(date: Date): { hours: number; minutes: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const hours = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minutes = Number(parts.find((part) => part.type === "minute")?.value ?? 0);

  return { hours, minutes };
}

function getEasternDayDifference(from: Date, to: Date): number {
  return getEasternDayNumber(to) - getEasternDayNumber(from);
}

function getEasternDayNumber(date: Date): number {
  const { year, month, day } = getEasternDateParts(date);
  return Date.UTC(year, month - 1, day) / DAY_IN_MS;
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
