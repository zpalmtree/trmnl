interface Env {
  SEASON_START_FALLBACK: string;
}

interface PointsEntry {
  Track: string;
  TrackType: string | null;
  EventsSessionsID: number;
  Points: number;
}

interface DriverStanding {
  DriverName: string;
  TotalPoints: number;
  TotalWins: number;
  TotalPoles: number;
  TotalTop5s: number;
  Points: PointsEntry[];
}

interface YearPointSummary {
  Year: number;
  SeriesTitle: string;
  UpdatedDate: string;
  DriverList: DriverStanding[];
}

interface NextRace {
  raceName: string;
  trackName: string;
  location: string;
  broadcast: string;
  date: Date;
}

const EASTERN_TIME_ZONE = "America/New_York";
const DAY_IN_MS = 1000 * 60 * 60 * 24;
const INDYCAR_SERIES_ID = "b856a4f1-e85c-4fac-8c36-fd58d962227a";
const RESULTS_API_BASE = "https://www.indycar.com/api/results";
const SCHEDULE_URL = "https://www.indycar.com/Schedule";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("OK", { status: 200 });
    }

    try {
      const now = new Date();
      const nextRace = await fetchNextRace();

      if (nextRace) {
        const completedRaces = await getCompletedRaceCount(getEasternDateParts(nextRace.date).year);
        const daysUntil = Math.max(0, getEasternDayDifference(now, nextRace.date));
        const isToday = daysUntil === 0;
        const isCompact = false;

        const mergeVariables = {
          is_offseason: "false",
          race_name: nextRace.raceName,
          circuit_name: nextRace.trackName,
          location: nextRace.location,
          race_date: formatDate(nextRace.date),
          race_time: formatTime(nextRace.date),
          days_until: isToday ? "Today" : String(daysUntil),
          days_label: isToday ? "" : daysUntil === 1 ? "day" : "days",
          countdown_value: isToday ? "Today" : String(daysUntil),
          countdown_note: isToday ? "Race day" : daysUntil === 1 ? "day to go" : "days to go",
          countdown_value_size: isToday ? "4.8rem" : "7rem",
          countdown_note_size: "1.3rem",
          countdown_note_margin_top: "8px",
          round: completedRaces > 0 ? `Round ${completedRaces + 1}` : "",
          broadcast: nextRace.broadcast || "TBD",
          inseason_display: "block",
          offseason_display: "none",
          instance_label: nextRace.broadcast || "Next Race",
          track_order: "1",
          race_order: "2",
          broadcast_order: "3",
          schedule_row_padding: isCompact ? "8px 12px" : "12px 12px",
          schedule_label_font_size: isCompact ? "0.88rem" : "0.95rem",
          schedule_date_font_size: isCompact ? "1rem" : "1.1rem",
          schedule_race_date_font_size: isCompact ? "1.06rem" : "1.2rem",
        };

        if (url.pathname === "/api") {
          return jsonResponse({
            ...mergeVariables,
            raw: {
              next_race: {
                ...nextRace,
                date: nextRace.date.toISOString(),
              },
              completed_races: completedRaces,
            },
          });
        }
        return jsonResponse(mergeVariables);
      }

      const championData = await fetchLatestStandings();
      const champion = championData.DriverList
        .slice()
        .sort((left, right) => right.TotalPoints - left.TotalPoints)[0];
      const fallbackDate = parseEasternDateTime(env.SEASON_START_FALLBACK)
        ?? new Date("2027-03-01T17:00:00Z");
      const safeDaysUntilSeason = Math.max(0, getEasternDayDifference(now, fallbackDate));

      const mergeVariables = {
        is_offseason: "true",
        season_year: getEasternDateParts(fallbackDate).year,
        days_until: safeDaysUntilSeason,
        days_label: safeDaysUntilSeason === 1 ? "day" : "days",
        first_race_name: "Next IndyCar Season",
        first_race_location: "TBD",
        first_race_date: formatDate(fallbackDate),
        champion_name: champion?.DriverName || "TBD",
        champion_team: champion ? `${champion.TotalPoles} poles · ${champion.TotalTop5s} top 5` : "",
        champion_points: champion?.TotalPoints || 0,
        champion_wins: champion?.TotalWins || 0,
        last_season: championData.Year,
        inseason_display: "none",
        offseason_display: "block",
        instance_label: "Off-Season",
      };

      if (url.pathname === "/api") {
        return jsonResponse({
          ...mergeVariables,
          raw: {
            champion,
          },
        });
      }
      return jsonResponse(mergeVariables);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("IndyCar Schedule error:", message);
      return errorResponse(message);
    }
  },
};

async function fetchNextRace(): Promise<NextRace | null> {
  const res = await fetch(SCHEDULE_URL);

  if (!res.ok) {
    throw new Error(`Schedule page returned ${res.status}`);
  }

  const html = await res.text();
  const start = html.indexOf('<section class="feature-card next-race"');
  if (start === -1) return null;

  const end = html.indexOf('<h2 class="schedule-list-desktop-header"', start);
  const section = html.slice(start, end === -1 ? undefined : end);
  const raceName = decodeHtml(extractText(section, /<h3 class="event-card-title">([\s\S]*?)<\/h3>/));
  const trackName = decodeHtml(extractText(section, /<div class="event-card-track-name">([\s\S]*?)<\/div>/));
  const location = decodeHtml(extractText(section, /<div class="event-card-track-location">([\s\S]*?)<\/div>/));
  const timeLabel = decodeHtml(extractText(section, /<div class="event-card-header-time">([\s\S]*?)<\/div>/));
  const dateLabel = decodeHtml(extractText(section, /<div class="event-card-header-date">([\s\S]*?)<\/div>/));
  const toDate = decodeHtml(extractText(section, /data-todate="([^"]+)"/));
  const broadcast = decodeHtml(extractNetwork(section));
  const raceDate = parseEasternDateTime(toDate) ?? parseDateLabel(dateLabel, timeLabel);

  if (!raceName || !raceDate) {
    return null;
  }

  return {
    raceName,
    trackName,
    location,
    broadcast,
    date: raceDate,
  };
}

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

async function getCompletedRaceCount(year: number): Promise<number> {
  const standings = await fetchStandings(year);
  const completedSessionIds = new Set<number>();

  for (const driver of standings.DriverList ?? []) {
    for (const points of driver.Points ?? []) {
      if (points.Track !== "Total" && points.EventsSessionsID !== 0 && points.Points > 0) {
        completedSessionIds.add(points.EventsSessionsID);
      }
    }
  }

  return completedSessionIds.size;
}

function extractText(value: string, pattern: RegExp): string {
  return (value.match(pattern)?.[1] ?? "").replace(/<[^>]+>/g, "").trim();
}

function extractNetwork(section: string): string {
  const networkBlock = section.match(/<div class="event-card-header-network">([\s\S]*?)<\/div>/)?.[1] ?? "";
  const matches = [...networkBlock.matchAll(/alt="([^"]+)"/g)]
    .map((match) => match[1].trim())
    .filter(Boolean);

  return matches[0] ?? "";
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .trim();
}

function parseDateLabel(dateLabel: string, timeLabel: string): Date | null {
  const currentYear = getEasternDateParts(new Date()).year;
  const match = dateLabel.match(/^([A-Za-z]{3})\s+(\d{1,2})$/);
  if (!match) return null;

  const [, monthName, day] = match;
  const month = monthIndex(monthName);
  if (month === null) return null;

  let hours = 12;
  let minutes = 0;
  const timeMatch = timeLabel.match(/^(\d{1,2}):(\d{2})\s+(AM|PM)\s+ET$/i);
  if (timeMatch) {
    hours = Number(timeMatch[1]);
    minutes = Number(timeMatch[2]);
    const meridiem = timeMatch[3].toUpperCase();
    if (meridiem === "PM" && hours !== 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;
  }

  return easternPartsToDate(currentYear, month + 1, Number(day), hours, minutes, 0);
}

function parseEasternDateTime(value: string): Date | null {
  if (!value) return null;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) return null;

  const [, year, month, day, hour = "12", minute = "00", second = "00"] = match;
  return easternPartsToDate(Number(year), Number(month), Number(day), Number(hour), Number(minute), Number(second));
}

function easternPartsToDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const offsetMinutes = getTimeZoneOffsetMinutes(utcGuess);
  return new Date(utcGuess.getTime() - offsetMinutes * 60 * 1000);
}

function getTimeZoneOffsetMinutes(date: Date): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    timeZoneName: "shortOffset",
  });

  const timeZoneName = formatter
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value ?? "GMT-5";
  const match = timeZoneName.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);

  if (!match) {
    return isLikelyEasternDst(date) ? -240 : -300;
  }

  const [, sign, hours, minutes = "0"] = match;
  const total = Number(hours) * 60 + Number(minutes);
  return sign === "-" ? -total : total;
}

function isLikelyEasternDst(date: Date): boolean {
  const month = date.getUTCMonth();
  return month >= 2 && month <= 10;
}

function monthIndex(monthName: string): number | null {
  const month = monthName.toLowerCase();
  const names = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  const index = names.findIndex((name) => month.startsWith(name));

  return index >= 0 ? index : null;
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
