// Draws GitHub's green contribution grid (dark theme) as dist/contrib.svg — no snake.
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
const W = LEFT + cal.weeks.length * STEP + 16, H = TOP + 7 * STEP + 40;
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

let cells = "", months = "", lastMonth = -1;
cal.weeks.forEach((w, x) => {
  const m = new Date(w.contributionDays[0].date).getUTCMonth();
  if (m !== lastMonth && x < cal.weeks.length - 2) {
    months += `<text x="${LEFT + x * STEP}" y="${TOP - 10}" class="l">${MONTHS[m]}</text>`;
    lastMonth = m;
  }
  for (const d of w.contributionDays) {
    cells += `<rect x="${LEFT + x * STEP}" y="${TOP + d.weekday * STEP}" width="${CELL}" height="${CELL}" rx="2.5" fill="${COLORS[d.contributionLevel]}" style="animation-delay:${(x * 0.02).toFixed(2)}s"><title>${d.date}: ${d.contributionCount}</title></rect>`;
  }
});
const days = ["", "Mon", "", "Wed", "", "Fri", ""].map((t, i) => t && `<text x="0" y="${TOP + i * STEP + 10}" class="l">${t}</text>`).join("");
const LX = W - 16 - 34 - 5 * STEP; // legend start, leaves room for "More" on the right
const legend = Object.values(COLORS).map((c, i) => `<rect x="${LX + i * STEP}" y="${H - 22}" width="${CELL}" height="${CELL}" rx="2.5" fill="${c}"/>`).join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>
  .l{font:11px 'Segoe UI',Helvetica,Arial,sans-serif;fill:#7d8590}
  rect[style]{opacity:0;animation:in .4s ease-out forwards}
  @keyframes in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
</style>
<rect width="100%" height="100%" rx="10" fill="#0d1117"/>
${months}${days}${cells}
<text x="${LEFT}" y="${H - 12}" class="l">${cal.totalContributions} contributions in the last year</text>
<text x="${LX - 6}" y="${H - 12}" class="l" text-anchor="end">Less</text>${legend}<text x="${W - 16}" y="${H - 12}" class="l" text-anchor="end">More</text>
</svg>`;

mkdirSync("dist", { recursive: true });
writeFileSync("dist/contrib.svg", svg);
console.log(`wrote dist/contrib.svg (${cal.weeks.length} weeks, ${cal.totalContributions} contributions)`);
