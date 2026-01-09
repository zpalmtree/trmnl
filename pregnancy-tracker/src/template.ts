import { WeekData, getTrimesterName } from "./pregnancy-data";

export interface TemplateData {
  week: number;
  day: number;
  daysRemaining: number;
  weekData: WeekData;
  percentComplete: number;
}

export function generateHtml(data: TemplateData): string {
  const { week, day, daysRemaining, weekData, percentComplete } = data;
  const trimesterName = getTrimesterName(weekData.trimester);

  // Progress bar segments (using text characters for e-ink)
  const progressBarWidth = 20;
  const filledSegments = Math.round((percentComplete / 100) * progressBarWidth);
  const emptySegments = progressBarWidth - filledSegments;
  const progressBar = "█".repeat(filledSegments) + "░".repeat(emptySegments);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://usetrmnl.com/css/latest/plugins.css">
  <script src="https://usetrmnl.com/js/latest/plugins.js"></script>
  <style>
    .week-display {
      font-size: 4rem;
      font-weight: bold;
      line-height: 1;
    }
    .day-display {
      font-size: 1.5rem;
      opacity: 0.8;
    }
    .size-icon {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }
    .progress-bar {
      font-family: monospace;
      letter-spacing: 2px;
    }
    .fact-box {
      border: 2px solid #000;
      padding: 12px;
      margin-top: 8px;
    }
    .section-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.7;
    }
  </style>
</head>
<body class="environment trmnl">
  <div class="screen">
    <div class="view view--full">
      <div class="layout layout--col gap--space-between">

        <!-- Top Section: Week Counter -->
        <div class="columns">
          <div class="column text--center">
            <div class="section-label">Pregnancy Progress</div>
            <div class="week-display">Week ${week}</div>
            <div class="day-display">Day ${day}</div>
            <div class="mt--md">
              <span class="progress-bar">${progressBar}</span>
              <div class="text--center mt--xs">${percentComplete}% complete</div>
            </div>
          </div>
        </div>

        <!-- Middle Section: Baby Size & Stats -->
        <div class="columns">
          <div class="column column--half">
            <div class="section-label">Baby's Size</div>
            <div class="title mt--xs">${weekData.size}</div>
            <div class="label">${weekData.length} · ${weekData.weight}</div>
          </div>
          <div class="column column--half text--right">
            <div class="section-label">Time Remaining</div>
            <div class="title mt--xs">${daysRemaining} days</div>
            <div class="label">${Math.floor(daysRemaining / 7)} weeks to go</div>
          </div>
        </div>

        <!-- Development Section -->
        <div class="columns">
          <div class="column">
            <div class="section-label">This Week's Development</div>
            <div class="description mt--xs">${weekData.development}</div>
          </div>
        </div>

        <!-- Fun Fact Section -->
        <div class="columns">
          <div class="column">
            <div class="fact-box">
              <div class="section-label">Did You Know?</div>
              <div class="description mt--xs">${weekData.funFact}</div>
            </div>
          </div>
        </div>

      </div>

      <div class="title_bar">
        <span class="title">Baby Tracker</span>
        <span class="instance">${trimesterName}</span>
      </div>
    </div>
  </div>
</body>
</html>`;
}
