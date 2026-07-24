#!/usr/bin/env node
/**
 * Self-hosted GitHub profile SVG — dark bento + animated contribution morph.
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
  const activeDays = weeks.flat().filter((count) => count > 0).length;
  const averagePerActiveDay =
    activeDays > 0 ? cal.totalContributions / activeDays : 0;
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
    mergedPrs: user.pullRequests?.totalCount ?? 0,
    contributions: cal.totalContributions,
    years,
    since: created.getFullYear(),
    languages,
    weeks,
    maxDay,
    activeDays,
    averagePerActiveDay,
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

/** 5×7 pixel glyphs — contribution-dot typography */
const GLYPHS = {
  0: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  2: ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  3: ["01110", "10001", "00001", "00110", "00001", "10001", "01110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  5: ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  6: ["01110", "10000", "11110", "10001", "10001", "10001", "01110"],
  7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  9: ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  k: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  ".": ["00000", "00000", "00000", "00000", "00000", "00100", "00100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

function glyphDots(text, cell = 8, gap = 2, tracking = 1) {
  const step = cell + gap;
  const dots = [];
  let cursor = 0;
  for (const ch of text) {
    const g = GLYPHS[ch] || GLYPHS[" "];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (g[row][col] === "1") {
          dots.push({ x: cursor + col * step, y: row * step });
        }
      }
    }
    cursor += (5 + tracking) * step;
  }
  return { dots, width: Math.max(0, cursor - tracking * step), height: 7 * step - gap };
}

/**
 * Phase 1: dots form the contribution count (e.g. "1.5k")
 * Phase 2: dots fly into the real heatmap cells
 * Then loop.
 */
function animatedContributionPanel(data, leftW) {
  const cell = 8;
  const cg = 2;
  const step = cell + cg;
  const areaW = leftW - 32;

  const targets = [];
  data.weeks.forEach((days, wi) => {
    days.forEach((count, di) => {
      targets.push({
        x: wi * step,
        y: di * step,
        count,
        color: heatColor(count, data.maxDay),
      });
    });
  });

  const heatH = 7 * step - cg;
  const heatW = data.weeks.length * step - cg;

  const word = fmt(data.contributions); // e.g. "1.5k"
  const { dots: textDots, width: textW, height: textH } = glyphDots(word, cell, cg, 1);
  const originX = Math.max(0, (Math.min(areaW, heatW) - textW) / 2);
  const originY = Math.max(0, (heatH - textH) / 2);

  // Prefer mapping text-dots onto active contribution cells first
  const destinations = [
    ...targets.filter((t) => t.count > 0),
    ...targets.filter((t) => t.count <= 0),
  ];

  const HOLD = 2.6;
  const MORPH = 2.4;
  const SETTLE = 4.2;
  const BACK = 1.6;
  const INTRO_DELAY = 4.6;
  const TOTAL = HOLD + MORPH + SETTLE + BACK;
  const tHold = +(HOLD / TOTAL).toFixed(4);
  const tMorphEnd = +((HOLD + MORPH) / TOTAL).toFixed(4);
  const tSettleEnd = +((HOLD + MORPH + SETTLE) / TOTAL).toFixed(4);
  const ease = "0 0 1 1;0.4 0 0.2 1;0 0 1 1;0.4 0 0.2 1";

  const used = new Set();
  let morphRects = "";

  textDots.forEach((dot, i) => {
    const dest = destinations[i];
    if (!dest) return;
    used.add(`${dest.x},${dest.y}`);
    const x0 = +(originX + dot.x).toFixed(1);
    const y0 = +(originY + dot.y).toFixed(1);
    const delay = +((i % 16) * 0.03).toFixed(3);
    const begin = +(INTRO_DELAY + delay).toFixed(3);

    morphRects += `<rect width="${cell}" height="${cell}" rx="2" x="${x0}" y="${y0}" fill="#5eead4">
  <animate attributeName="x" values="${x0};${x0};${dest.x};${dest.x};${x0}" keyTimes="0;${tHold};${tMorphEnd};${tSettleEnd};1" dur="${TOTAL}s" repeatCount="indefinite" begin="${begin}s" calcMode="spline" keySplines="${ease}"/>
  <animate attributeName="y" values="${y0};${y0};${dest.y};${dest.y};${y0}" keyTimes="0;${tHold};${tMorphEnd};${tSettleEnd};1" dur="${TOTAL}s" repeatCount="indefinite" begin="${begin}s" calcMode="spline" keySplines="${ease}"/>
  <animate attributeName="fill" values="#5eead4;#5eead4;${dest.color};${dest.color};#5eead4" keyTimes="0;${tHold};${tMorphEnd};${tSettleEnd};1" dur="${TOTAL}s" repeatCount="indefinite" begin="${begin}s"/>
</rect>
`;
  });

  let restRects = "";
  targets.forEach((t, i) => {
    if (used.has(`${t.x},${t.y}`)) return;
    const delay = +(INTRO_DELAY + (i % 28) * 0.01).toFixed(3);
    restRects += `<rect width="${cell}" height="${cell}" rx="2" x="${t.x}" y="${t.y}" fill="${t.color}" opacity="0">
  <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;${tHold};${tMorphEnd};${tSettleEnd};1" dur="${TOTAL}s" repeatCount="indefinite" begin="${delay}s"/>
</rect>
`;
  });

  const caption = `
  <text x="${(Math.min(areaW, heatW) / 2).toFixed(1)}" y="${heatH + 26}" text-anchor="middle" fill="${C.teal}" font-size="11" font-weight="600" font-family="${FONT}">
    <animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;${(tHold * 0.85).toFixed(4)};${tHold};${tSettleEnd};1" dur="${TOTAL}s" repeatCount="indefinite" begin="${INTRO_DELAY}s"/>
    ${esc(word)} contributions
  </text>
  <g opacity="0">
    <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;${tHold};${tMorphEnd};${tSettleEnd};1" dur="${TOTAL}s" repeatCount="indefinite" begin="${INTRO_DELAY}s"/>
    <text x="0" y="${heatH + 26}" fill="${C.faint}" font-size="10" font-family="${FONT}">Less</text>
    <rect x="30" y="${heatH + 18}" width="8" height="8" rx="2" fill="#1c1c22"/>
    <rect x="42" y="${heatH + 18}" width="8" height="8" rx="2" fill="#115e59"/>
    <rect x="54" y="${heatH + 18}" width="8" height="8" rx="2" fill="#0f766e"/>
    <rect x="66" y="${heatH + 18}" width="8" height="8" rx="2" fill="#14b8a6"/>
    <rect x="78" y="${heatH + 18}" width="8" height="8" rx="2" fill="#5eead4"/>
    <text x="92" y="${heatH + 26}" fill="${C.faint}" font-size="10" font-family="${FONT}">More</text>
    <text x="${Math.min(heatW, areaW)}" y="${heatH + 26}" text-anchor="end" fill="${C.faint}" font-size="10" font-family="${FONT}">last 12 months</text>
  </g>`;

  const insightsY = heatH + 54;
  const insightW = (areaW - 16) / 3;
  const insights = `
  <g transform="translate(0,${insightsY})">
    <line x1="0" y1="-12" x2="${areaW}" y2="-12" stroke="${C.line}"/>
    ${label("ACTIVE DAYS", 0, 8)}
    ${value(data.activeDays, 0, 34, 20)}
    ${label("BEST DAY", insightW, 8)}
    ${value(data.maxDay, insightW, 34, 20)}
    ${label("AVG / ACTIVE DAY", insightW * 2, 8)}
    ${value(data.averagePerActiveDay.toFixed(1), insightW * 2, 34, 20)}
  </g>`;

  return `<g transform="translate(16,44)">${morphRects}${restRects}${caption}${insights}</g>`;
}

/**
 * A one-shot roller blind intro. The pull tab drops first, then the shutter
 * retracts upward to reveal the dashboard. `fill="freeze"` keeps it open.
 */
function openingShutter(width, height) {
  const slatHeight = 22;
  let slats = "";
  for (let y = slatHeight; y < height; y += slatHeight) {
    slats += `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="#9a7419" stroke-width="1" opacity="0.42"/>`;
  }

  return `
  <defs>
    <g id="cat-face">
      <path d="M-20,-8 L-16,-27 L-5,-18 Q0,-21 5,-18 L16,-27 L20,-8 Q21,9 0,17 Q-21,9 -20,-8Z" fill="#171719"/>
      <ellipse cx="-7" cy="-2" rx="5" ry="7" fill="#fff8dc"/>
      <ellipse cx="7" cy="-2" rx="5" ry="7" fill="#fff8dc"/>
      <circle cx="-6" cy="0" r="2.4" fill="#171719"/>
      <circle cx="8" cy="0" r="2.4" fill="#171719"/>
      <path d="M-3,8 Q0,11 3,8" fill="none" stroke="#fff8dc" stroke-width="1.5" stroke-linecap="round"/>
    </g>
    <pattern id="cat-print" width="240" height="180" patternUnits="userSpaceOnUse" patternTransform="rotate(-2)">
      <use href="#cat-face" transform="translate(52 48) rotate(-8) scale(1.05)"/>
      <use href="#cat-face" transform="translate(174 112) rotate(11) scale(0.78)"/>
      <circle cx="12" cy="18" r="1" fill="#b98919" opacity="0.45"/>
      <circle cx="120" cy="80" r="1.2" fill="#fff0a8" opacity="0.35"/>
      <circle cx="220" cy="154" r="1" fill="#b98919" opacity="0.45"/>
    </pattern>
    <clipPath id="shutter-clip">
      <rect x="0" y="0" width="${width}" height="${height}">
        <animate attributeName="height" values="${height};${height};0" keyTimes="0;0.36;1" dur="4.6s" fill="freeze" calcMode="spline" keySplines="0 0 1 1;0.22 1 0.36 1"/>
      </rect>
    </clipPath>
    <linearGradient id="mustard-fabric" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f8dc62"/>
      <stop offset="0.42" stop-color="#e8bd35"/>
      <stop offset="0.72" stop-color="#d7a824"/>
      <stop offset="1" stop-color="#f2ca45"/>
    </linearGradient>
  </defs>

  <g clip-path="url(#shutter-clip)">
    <rect width="${width}" height="${height}" rx="18" fill="url(#mustard-fabric)"/>
    <rect width="${width}" height="${height}" rx="18" fill="url(#cat-print)"/>
    ${slats}
    <rect x="${width / 2 - 132}" y="${height / 2 - 34}" width="264" height="68" rx="18" fill="#f8dc62" stroke="#171719" stroke-width="2"/>
    <text x="${width / 2}" y="${height / 2 - 4}" text-anchor="middle" fill="#171719" font-size="13" font-weight="700" letter-spacing="0.14em" font-family="${FONT}">CURIOUS? PULL TO OPEN</text>
    <text x="${width / 2}" y="${height / 2 + 18}" text-anchor="middle" fill="#725718" font-size="10" font-family="${FONT}">GITHUB PROFILE · ${esc(USERNAME)}</text>
    <rect x="0" y="${height - 8}" width="${width}" height="8" fill="#171719"/>
  </g>

  <!-- Pull cord -->
  <g>
    <animate attributeName="opacity" values="1;1;1;0" keyTimes="0;0.32;0.9;1" dur="4.6s" fill="freeze"/>
    <rect x="0" y="0" width="${width}" height="16" rx="8" fill="#171719" stroke="#3a3020"/>
    <line x1="${width - 36}" y1="14" x2="${width - 36}" y2="366" stroke="#332b1a" stroke-width="3">
      <animate attributeName="y2" values="366;366;404;404;18" keyTimes="0;0.2;0.32;0.36;1" dur="4.6s" fill="freeze" calcMode="spline" keySplines="0 0 1 1;0.4 0 0.2 1;0 0 1 1;0.22 1 0.36 1"/>
    </line>

    <!-- Curious cat: looks around, grabs the pull, then rides upward -->
    <g>
      <animateTransform attributeName="transform" type="translate" values="0 0;0 0;0 38;0 38;0 -348" keyTimes="0;0.2;0.32;0.36;1" dur="4.6s" fill="freeze" calcMode="spline" keySplines="0 0 1 1;0.4 0 0.2 1;0 0 1 1;0.22 1 0.36 1"/>
      <path d="M${width - 125},360 C${width - 165},370 ${width - 158},326 ${width - 139},338" fill="none" stroke="#171719" stroke-width="12" stroke-linecap="round"/>
      <ellipse cx="${width - 108}" cy="360" rx="34" ry="43" fill="#171719"/>
      <path d="M${width - 131},319 L${width - 126},292 L${width - 112},304 Q${width - 103},300 ${width - 94},304 L${width - 79},292 L${width - 84},320 Q${width - 83},340 ${width - 107},344 Q${width - 132},340 ${width - 131},319Z" fill="#171719"/>
      <ellipse cx="${width - 117}" cy="316" rx="6.5" ry="8" fill="#fff8dc">
        <animate attributeName="ry" values="8;8;1;8;8" keyTimes="0;0.32;0.38;0.44;1" dur="1.2s" repeatCount="2"/>
      </ellipse>
      <ellipse cx="${width - 96}" cy="316" rx="6.5" ry="8" fill="#fff8dc">
        <animate attributeName="ry" values="8;8;1;8;8" keyTimes="0;0.32;0.38;0.44;1" dur="1.2s" repeatCount="2"/>
      </ellipse>
      <circle cx="${width - 119}" cy="317" r="3" fill="#171719">
        <animate attributeName="cx" values="${width - 119};${width - 114};${width - 120};${width - 117}" keyTimes="0;0.3;0.65;1" dur="1.35s" repeatCount="2" fill="freeze"/>
      </circle>
      <circle cx="${width - 98}" cy="317" r="3" fill="#171719">
        <animate attributeName="cx" values="${width - 98};${width - 93};${width - 99};${width - 96}" keyTimes="0;0.3;0.65;1" dur="1.35s" repeatCount="2" fill="freeze"/>
      </circle>
      <path d="M${width - 110},329 Q${width - 106},333 ${width - 102},329" fill="none" stroke="#fff8dc" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="${width - 122}" y1="328" x2="${width - 143}" y2="324" stroke="#fff8dc" stroke-width="1.2"/>
      <line x1="${width - 122}" y1="332" x2="${width - 144}" y2="334" stroke="#fff8dc" stroke-width="1.2"/>
      <line x1="${width - 91}" y1="328" x2="${width - 70}" y2="324" stroke="#fff8dc" stroke-width="1.2"/>
      <line x1="${width - 91}" y1="332" x2="${width - 69}" y2="335" stroke="#fff8dc" stroke-width="1.2"/>
      <path d="M${width - 85},347 Q${width - 63},350 ${width - 40},364" fill="none" stroke="#171719" stroke-width="11" stroke-linecap="round"/>
      <circle cx="${width - 39}" cy="364" r="7" fill="#171719"/>
    </g>

    <g>
      <animateTransform attributeName="transform" type="translate" values="0 0;0 0;0 38;0 38;0 -348" keyTimes="0;0.2;0.32;0.36;1" dur="4.6s" fill="freeze" calcMode="spline" keySplines="0 0 1 1;0.4 0 0.2 1;0 0 1 1;0.22 1 0.36 1"/>
      <rect x="${width - 47}" y="352" width="22" height="32" rx="11" fill="#171719"/>
      <circle cx="${width - 36}" cy="362" r="3.5" fill="#f8dc62"/>
    </g>
  </g>`;
}

function buildCard(data) {
  const W = 920;
  const H = 500;
  const updated = new Date().toISOString().slice(0, 10);
  const line2 = [data.bio, data.location, data.status].filter(Boolean).join("  ·  ");

  const pad = 18;
  const gap = 12;
  const leftW = 580;
  const rightW = W - pad * 2 - gap - leftW;

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
    // Left accent bar — never overlaps label text
    metricCards += card(
      x,
      148,
      mW,
      78,
      `<rect x="0" y="14" width="3" height="50" rx="1.5" fill="${color}"/>
       ${label(lab, 16, 28)}
       ${value(val, 16, 58, 24)}`,
    );
  });

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

  ${card(
    pad,
    240,
    leftW,
    242,
    `
    ${label("CONTRIBUTION ACTIVITY", 16, 26)}
    ${animatedContributionPanel(data, leftW)}
  `,
  )}

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
  ${openingShutter(W, H)}
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
