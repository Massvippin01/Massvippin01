// Draws a blue contribution grid plus a stats row as dist/contrib.svg.
// README images are static (no hover), so the useful numbers are printed on the card.
// Usage: GITHUB_TOKEN=... USER_NAME=name node contrib.mjs
import { mkdirSync, writeFileSync } from "node:fs";

const user = process.env.USER_NAME;
const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: { Authorization: `bearer ${process.env.GITHUB_TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    query: `query($u:String!){user(login:$u){contributionsCollection{contributionCalendar{
      totalContributions weeks{contributionDays{date weekday contributionCount contributionLevel}}}}}}`,
    variables: { u: user },
  }),
});
const json = await res.json();
if (!json.data?.user) throw new Error("GraphQL failed: " + JSON.stringify(json.errors ?? json));
const cal = json.data.user.contributionsCollection.contributionCalendar;

const COLORS = { NONE: "#161b22", FIRST_QUARTILE: "#0c2d6b", SECOND_QUARTILE: "#1f4fbf", THIRD_QUARTILE: "#388bfd", FOURTH_QUARTILE: "#79c0ff" };
const CELL = 12, GAP = 3, STEP = CELL + GAP, LEFT = 36, TOP = 34;
const GRID_H = TOP + 7 * STEP + 40, STATS_H = 78;
const W = LEFT + cal.weeks.length * STEP + 16, H = GRID_H + STATS_H;

// --- stats ---
const all = cal.weeks.flatMap(w => w.contributionDays);
const today = new Date().toISOString().slice(0, 10);
const days = all.filter(d => d.date <= today);
const best = days.reduce((a, d) => (d.contributionCount > a.contributionCount ? d : a), days[0]);
let longest = 0, run = 0;
for (const d of days) { run = d.contributionCount ? run + 1 : 0; longest = Math.max(longest, run); }
let current = 0, i = days.length - 1;
if (days[i]?.contributionCount === 0) i--; // today not committed yet doesn't break the streak
for (; i >= 0 && days[i].contributionCount; i--) current++;
const WD = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const perWd = Array(7).fill(0); days.forEach(d => perWd[d.weekday] += d.contributionCount);
const busiest = WD[perWd.indexOf(Math.max(...perWd))];
const active = days.filter(d => d.contributionCount).length;
const fmt = iso => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const STATS = [
  [cal.totalContributions, "contributions"],
  [`${best.contributionCount}`, `best day · ${fmt(best.date)}`],
  [`${current}d`, "current streak"],
  [`${longest}d`, "longest streak"],
  [`${active}`, "active days"],
  [busiest.slice(0, 3), "busiest weekday"],
];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

let cells = "", months = "", lastMonth = -1;
cal.weeks.forEach((w, x) => {
  const m = new Date(w.contributionDays[0].date).getUTCMonth();
  if (m !== lastMonth && x < cal.weeks.length - 2) {
    months += `<text x="${LEFT + x * STEP}" y="${TOP - 10}" class="l">${MONTHS[m]}</text>`;
    lastMonth = m;
  }
  for (const d of w.contributionDays) {
    if (d.date === best.date) cells += `<rect x="${LEFT + x * STEP - 2.5}" y="${TOP + d.weekday * STEP - 2.5}" width="${CELL + 5}" height="${CELL + 5}" rx="4" class="best"/>`;
    cells += `<rect x="${LEFT + x * STEP}" y="${TOP + d.weekday * STEP}" width="${CELL}" height="${CELL}" rx="2.5" fill="${COLORS[d.contributionLevel]}" style="animation-delay:${(x * 0.02).toFixed(2)}s"><title>${d.date}: ${d.contributionCount}</title></rect>`;
  }
});
const dayLabels = ["", "Mon", "", "Wed", "", "Fri", ""].map((t, i) => t && `<text x="0" y="${TOP + i * STEP + 10}" class="l">${t}</text>`).join("");
const LX = W - 16 - 34 - 5 * STEP; // legend start, leaves room for "More" on the right
const legend = Object.values(COLORS).map((c, i) => `<rect x="${LX + i * STEP}" y="${GRID_H - 22}" width="${CELL}" height="${CELL}" rx="2.5" fill="${c}"/>`).join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>
  .l{font:11px 'Segoe UI',Helvetica,Arial,sans-serif;fill:#7d8590}
  .v{font:600 22px 'Segoe UI',Helvetica,Arial,sans-serif;fill:#79c0ff}
  .best{fill:none;stroke:#79c0ff;stroke-width:1.5;animation:pulse 2s ease-in-out infinite}
  @keyframes pulse{0%,100%{stroke-opacity:1}50%{stroke-opacity:.25}}
  rect[style]{opacity:0;animation:in .4s ease-out forwards}
  @keyframes in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
</style>
<rect width="100%" height="100%" rx="10" fill="#0d1117"/>
${months}${dayLabels}${cells}
<text x="${LEFT}" y="${GRID_H - 12}" class="l">Highlighted: best day</text>
<text x="${LX - 6}" y="${GRID_H - 12}" class="l" text-anchor="end">Less</text>${legend}<text x="${W - 16}" y="${GRID_H - 12}" class="l" text-anchor="end">More</text>
<line x1="${LEFT}" x2="${W - 16}" y1="${GRID_H}" y2="${GRID_H}" stroke="#21262d"/>
${STATS.map(([v, k], n) => { const cw = (W - 16 - LEFT) / STATS.length, cx = LEFT + n * cw + cw / 2;
  return `<text x="${cx}" y="${GRID_H + 36}" class="v" text-anchor="middle">${v}</text><text x="${cx}" y="${GRID_H + 56}" class="l" text-anchor="middle">${k}</text>`; }).join("")}
</svg>`;

mkdirSync("dist", { recursive: true });
writeFileSync("dist/contrib.svg", svg);
console.log(`wrote dist/contrib.svg (${cal.weeks.length} weeks)`, STATS.map(s => s.join(' ')).join(' | '));
