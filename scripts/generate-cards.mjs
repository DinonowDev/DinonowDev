#!/usr/bin/env node
/**
 * Self-hosted GitHub profile SVG — dark bento layout.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const USERNAME = process.env.GH_USERNAME || "DinonowDev";
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";

const SOCIAL = {
  telegram: { handle: "@dinonow", url: "https://t.me/dinonow" },
  linkedin: { handle: "linkedin/in/dinonow", url: "https://www.linkedin.com/in/dinonow" },
  github: { handle: "github.com/DinonowDev", url: "https://github.com/DinonowDev" },
};

const C = {
  bg: "#09090b",
  card: "#131316",
  line: "#27272a",
  text: "#fafafa",
  muted: "#a1a1aa",
  faint: "#52525b",
  teal: "#2dd4bf",
  sky: "#38bdf8",
  violet: "#a78bfa",
  amber: "#fbbf24",
  rose: "#fb7185",
  green: "#4ade80",
};

const HIDE_LANGS = new Set(["Vim Script", "Vim Snippet", "C", "Makefile", "Shell"]);
const FONT = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";

const QUERY = `
query ($login: String!) {
  user(login: $login) {
    name login bio location createdAt
    status { message }
    followers { totalCount }
    following { totalCount }
    pullRequests(states: MERGED) { totalCount }
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC) {
      totalCount
      nodes {
        stargazerCount forkCount
        languages(first: 12, orderBy: { field: SIZE, direction: DESC }) {
          edges { size node { name color } }
        }
      }
    }
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { contributionCount } }
      }
    }
  }
}
`;

async function fetchUser() {
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "dinonowdev-profile-cards",
  };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers,
    body: JSON.stringify({ query: QUERY, variables: { login: USERNAME } }),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
  return json.data.user;
}

function aggregate(user) {
  const langBytes = new Map();
  const langColor = new Map();
  let stars = 0;
  let forks = 0;

  for (const repo of user.repositories.nodes) {
    stars += repo.stargazerCount;
    forks += repo.forkCount;
    for (const edge of repo.languages.edges) {
      const name = edge.node.name;
      if (HIDE_LANGS.has(name)) continue;
      langBytes.set(name, (langBytes.get(name) || 0) + edge.size);
      langColor.set(name, edge.node.color || C.sky);
    }
  }

  const totalBytes = [...langBytes.values()].reduce((a, b) => a + b, 0) || 1;
  const languages = [...langBytes.entries()]
    .map(([name, size]) => ({
      name,
      pct: (size / totalBytes) * 100,
      color: langColor.get(name),
    }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5);

  const cal = user.contributionsCollection.contributionCalendar;
  const weeks = cal.weeks.map((w) => w.contributionDays.map((d) => d.contributionCount));
  const maxDay = Math.max(1, ...weeks.flat());
  const created = new Date(user.createdAt);
  const years = Math.max(
    1,
    Math.floor((Date.now() - created.getTime()) / (365.25 * 24 * 3600 * 1000)),
  );

  return {
    name: user.name || user.login,
    login: user.login,
    bio: (user.bio || "Front-end Developer").replace(/\r?\n/g, " ").trim(),
    location: user.location || "",
    status: user.status?.message || "",
    followers: user.followers.totalCount,
    following: user.following.totalCount,
    repos: user.repositories.totalCount,
    stars,
    forks,
    mergedPrs: user.pullRequests.totalCount,
    contributions: cal.totalContributions,
    years,
    since: created.getFullYear(),
    languages,
    weeks,
    maxDay,
  };
}

function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fmt(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}k`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function heatColor(count, max) {
  if (count <= 0) return "#1c1c22";
  const t = Math.min(1, count / max);
  if (t < 0.25) return "#115e59";
  if (t < 0.5) return "#0f766e";
  if (t < 0.75) return "#14b8a6";
  return "#5eead4";
}

function card(x, y, w, h, inner) {
  return `<g transform="translate(${x},${y})">
  <rect width="${w}" height="${h}" rx="14" fill="${C.card}" stroke="${C.line}"/>
  ${inner}
</g>`;
}

function label(text, x, y) {
  return `<text x="${x}" y="${y}" fill="${C.muted}" font-size="10" letter-spacing="0.08em" font-family="${FONT}">${esc(text)}</text>`;
}

function value(text, x, y, size = 26) {
  return `<text x="${x}" y="${y}" fill="${C.text}" font-size="${size}" font-weight="600" font-family="${FONT}">${esc(text)}</text>`;
}

function buildCard(data) {
  const W = 920;
  const H = 500;
  const updated = new Date().toISOString().slice(0, 10);
  const line2 = [data.bio, data.location, data.status].filter(Boolean).join("  ·  ");

  // grid math
  const pad = 18;
  const gap = 12;
  const col = (W - pad * 2 - gap * 2) / 3; // 3 equal columns ≈ 286.67 — use explicit
  // Better: left stack 580, right 292
  const leftW = 580;
  const rightW = W - pad * 2 - gap - leftW; // 292
  const metricW = (leftW - gap * 3) / 4; // 4 metrics under hero area... actually full width 6 metrics

  // Full-width metrics: 6 cards
  const mCount = 6;
  const mW = (W - pad * 2 - gap * (mCount - 1)) / mCount;

  const metrics = [
    ["STARS", fmt(data.stars), C.amber],
    ["REPOS", fmt(data.repos), C.sky],
    ["FOLLOWERS", fmt(data.followers), C.violet],
    ["FOLLOWING", fmt(data.following), C.rose],
    ["MERGED PRS", fmt(data.mergedPrs), C.teal],
    ["FORKS", fmt(data.forks), C.green],
  ];

  let metricCards = "";
  metrics.forEach(([lab, val, color], i) => {
    const x = pad + i * (mW + gap);
    metricCards += card(
      x,
      148,
      mW,
      78,
      `${label(lab, 14, 24)}
       <circle cx="14" cy="20" r="2.5" fill="${color}"/>
       ${value(val, 14, 56, 24)}`,
    );
  });

  // heatmap — must fit inside leftW with padding
  const cell = 8;
  const cg = 2;
  let cells = "";
  data.weeks.forEach((days, wi) => {
    days.forEach((count, di) => {
      cells += `<rect x="${wi * (cell + cg)}" y="${di * (cell + cg)}" width="${cell}" height="${cell}" rx="2" fill="${heatColor(count, data.maxDay)}"/>`;
    });
  });
  const heatH = 7 * (cell + cg) - cg;
  const heatW = data.weeks.length * (cell + cg) - cg;

  // languages
  let langRows = "";
  data.languages.forEach((lang, i) => {
    const barMax = rightW - 36;
    const barW = Math.max(4, (lang.pct / 100) * barMax);
    langRows += `<g transform="translate(16,${48 + i * 34})">
      <text x="0" y="0" fill="${C.text}" font-size="12" font-family="${FONT}">${esc(lang.name)}</text>
      <text x="${barMax}" y="0" text-anchor="end" fill="${C.muted}" font-size="11" font-family="${FONT}">${lang.pct.toFixed(0)}%</text>
      <rect x="0" y="8" width="${barMax}" height="4" rx="2" fill="${C.bg}"/>
      <rect x="0" y="8" width="${barW}" height="4" rx="2" fill="${lang.color}"/>
    </g>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">
  <title>${esc(data.name)} — GitHub profile</title>
  <rect width="${W}" height="${H}" rx="18" fill="${C.bg}"/>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="17.5" fill="none" stroke="${C.line}"/>

  <!-- Identity -->
  ${card(
    pad,
    pad,
    leftW,
    116,
    `
    ${value(data.name, 20, 40, 24)}
    <text x="20" y="64" fill="${C.muted}" font-size="13" font-family="${FONT}">${esc(line2)}</text>
    <text x="20" y="92" fill="${C.faint}" font-size="12" font-family="${FONT}">${esc(SOCIAL.telegram.handle)}   ·   ${esc(SOCIAL.linkedin.handle)}   ·   ${esc(SOCIAL.github.handle)}</text>
  `,
  )}

  <!-- Years + total contrib -->
  ${card(
    pad + leftW + gap,
    pad,
    rightW,
    116,
    `
    ${label("ON GITHUB", 16, 28)}
    ${value(`${data.years} years`, 16, 58, 24)}
    <text x="16" y="82" fill="${C.faint}" font-size="12" font-family="${FONT}">since ${data.since}</text>
    <text x="16" y="102" fill="${C.teal}" font-size="12" font-weight="600" font-family="${FONT}">${fmt(data.contributions)} contributions</text>
  `,
  )}

  ${metricCards}

  <!-- Heatmap -->
  ${card(
    pad,
    240,
    leftW,
    242,
    `
    ${label("CONTRIBUTION ACTIVITY", 16, 26)}
    <g transform="translate(16,44)">${cells}</g>
    <g transform="translate(16,${44 + heatH + 16})">
      <text x="0" y="8" fill="${C.faint}" font-size="10" font-family="${FONT}">Less</text>
      <rect x="30" y="0" width="8" height="8" rx="2" fill="#1c1c22"/>
      <rect x="42" y="0" width="8" height="8" rx="2" fill="#115e59"/>
      <rect x="54" y="0" width="8" height="8" rx="2" fill="#0f766e"/>
      <rect x="66" y="0" width="8" height="8" rx="2" fill="#14b8a6"/>
      <rect x="78" y="0" width="8" height="8" rx="2" fill="#5eead4"/>
      <text x="92" y="8" fill="${C.faint}" font-size="10" font-family="${FONT}">More</text>
      <text x="${Math.min(heatW, leftW - 40)}" y="8" text-anchor="end" fill="${C.faint}" font-size="10" font-family="${FONT}">last 12 months</text>
    </g>
  `,
  )}

  <!-- Languages -->
  ${card(
    pad + leftW + gap,
    240,
    rightW,
    242,
    `
    ${label("TOP LANGUAGES", 16, 26)}
    ${langRows}
  `,
  )}

  <text x="${W - pad}" y="${H - 8}" text-anchor="end" fill="${C.faint}" font-size="9" font-family="${FONT}">${updated}</text>
</svg>
`;
}

async function main() {
  console.log(`Fetching @${USERNAME}...`);
  const data = aggregate(await fetchUser());
  await mkdir(join(ROOT, "assets"), { recursive: true });
  await writeFile(join(ROOT, "assets", "profile-card.svg"), buildCard(data));
  console.log("Wrote assets/profile-card.svg");
  console.log(
    `${data.stars}★ ${data.repos} repos ${data.followers} followers ${data.mergedPrs} PRs ${data.contributions} contrib`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
