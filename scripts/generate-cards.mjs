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
  const INTRO_DELAY = 7.8;
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

  // Single 7.6s storyboard shared by the blind, the cord and the cat.
  const DUR = 7.6;
  const at = (s) => +(s / DUR).toFixed(4);
  const K = {
    walkedIn: at(1.0),
    planted: at(1.3),
    lookAEnd: at(2.9),
    grabbed: at(3.25),
    yankEnd: at(3.75),
    released: at(4.0),
    letGo: at(4.2),
    blindUp: at(5.5),
    lookBEnd: at(6.5),
  };
  // Roller blinds travel fast then settle; keep it readable rather than snappy.
  const BLIND_EASE = "0 0 1 1;0.45 0 0.12 1;0 0 1 1";

  // Cat stands on the very bottom edge of the card; its raised paw meets the cord.
  const catX = width - 82;
  const catY = height - 6;
  const cordX = width - 36;
  const cordRestY = catY - 116;
  const cordPullY = catY + 14 - 82;

  const armRest = "M19,-72 C32,-86 42,-104 46,-116";
  const armPull = "M19,-64 C30,-70 40,-76 44,-82";
  // Two "check both sides" beats: one before the pull, one before slipping away.
  const lookTimes = [
    0, K.planted,
    at(1.75), at(2.05), at(2.45), at(2.75), K.lookAEnd,
    K.blindUp,
    at(5.8), at(6.0), at(6.25), at(6.4), K.lookBEnd,
    1,
  ].join(";");
  const lookAngles = [0, 0, -9, -9, 10, 10, 0, 0, -9, -9, 10, 10, 0, 0];
  const headTurn = lookAngles.map((a) => `${a} 0 -88`).join(";");
  const eyeShift = lookAngles.map((a) => `${a * 0.45} 0`).join(";");

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
    <clipPath id="card-clip">
      <rect x="0" y="0" width="${width}" height="${height}" rx="18"/>
    </clipPath>
    <clipPath id="shutter-clip">
      <rect x="0" y="0" width="${width}" height="${height}">
        <animate attributeName="height" values="${height};${height};0;0" keyTimes="0;${K.released};${K.blindUp};1" dur="${DUR}s" fill="freeze" calcMode="spline" keySplines="${BLIND_EASE}"/>
      </rect>
    </clipPath>
    <filter id="cat-glow" x="-45%" y="-45%" width="190%" height="190%">
      <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#f8dc62" flood-opacity="0.22"/>
    </filter>
    <linearGradient id="mustard-fabric" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f8dc62"/>
      <stop offset="0.42" stop-color="#e8bd35"/>
      <stop offset="0.72" stop-color="#d7a824"/>
      <stop offset="1" stop-color="#f2ca45"/>
    </linearGradient>
    <linearGradient id="blind-edge-shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#000" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="cat-shadow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#000" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <g clip-path="url(#card-clip)">
    <g clip-path="url(#shutter-clip)">
      <rect width="${width}" height="${height}" rx="18" fill="url(#mustard-fabric)"/>
      <rect width="${width}" height="${height}" rx="18" fill="url(#cat-print)"/>
      ${slats}
      <rect x="${width / 2 - 138}" y="${height / 2 - 36}" width="276" height="72" rx="20" fill="#f8dc62" stroke="#171719" stroke-width="2"/>
      <text x="${width / 2}" y="${height / 2 - 4}" text-anchor="middle" fill="#171719" font-size="13" font-weight="700" letter-spacing="0.14em" font-family="${FONT}">CURIOUS? PULL TO OPEN</text>
      <text x="${width / 2}" y="${height / 2 + 18}" text-anchor="middle" fill="#725718" font-size="10" font-family="${FONT}">GITHUB PROFILE · ${esc(USERNAME)}</text>
      <rect x="0" y="${height - 8}" width="${width}" height="8" fill="#171719"/>
    </g>

    <!-- Soft shadow that trails the rising blind -->
    <rect x="0" y="${height}" width="${width}" height="26" fill="url(#blind-edge-shade)">
      <animate attributeName="y" values="${height};${height};0;0" keyTimes="0;${K.released};${K.blindUp};1" dur="${DUR}s" fill="freeze" calcMode="spline" keySplines="${BLIND_EASE}"/>
      <animate attributeName="opacity" values="1;1;0;0" keyTimes="0;${K.blindUp - 0.04};${K.blindUp};1" dur="${DUR}s" fill="freeze"/>
    </rect>

    <!-- Roller bar + pull cord -->
    <g>
      <animate attributeName="opacity" values="1;1;0;0" keyTimes="0;${K.lookBEnd};0.96;1" dur="${DUR}s" fill="freeze"/>
      <rect x="0" y="0" width="${width}" height="16" rx="8" fill="#171719" stroke="#3a3020"/>
      <line x1="${cordX}" y1="14" x2="${cordX}" y2="${cordRestY}" stroke="#332b1a" stroke-width="3">
        <animate attributeName="y2" values="${cordRestY};${cordRestY};${cordPullY};${cordPullY};18;18" keyTimes="0;${K.grabbed};${K.yankEnd};${K.released};${K.blindUp};1" dur="${DUR}s" fill="freeze" calcMode="spline" keySplines="0 0 1 1;0.4 0 0.2 1;0 0 1 1;0.45 0 0.12 1;0 0 1 1"/>
      </line>
      <g>
        <animateTransform attributeName="transform" type="translate" values="0 0;0 0;0 ${cordPullY - cordRestY};0 ${cordPullY - cordRestY};0 ${18 - cordRestY};0 ${18 - cordRestY}" keyTimes="0;${K.grabbed};${K.yankEnd};${K.released};${K.blindUp};1" dur="${DUR}s" fill="freeze" calcMode="spline" keySplines="0 0 1 1;0.4 0 0.2 1;0 0 1 1;0.45 0 0.12 1;0 0 1 1"/>
        <rect x="${cordX - 11}" y="${cordRestY - 8}" width="22" height="32" rx="11" fill="#171719"/>
        <circle cx="${cordX}" cy="${cordRestY + 2}" r="3.5" fill="#f8dc62"/>
      </g>
    </g>

    <!-- Sparkles on reveal -->
    ${[
      [width * 0.2, height * 0.32, 0],
      [width * 0.46, height * 0.2, 0.12],
      [width * 0.68, height * 0.4, 0.06],
      [width * 0.84, height * 0.24, 0.18],
      [width * 0.32, height * 0.62, 0.22],
    ]
      .map(([sx, sy, lag]) => {
        const t0 = K.blindUp - 0.05 + lag * 0.35;
        return `<g opacity="0" transform="translate(${sx.toFixed(1)},${sy.toFixed(1)})">
      <animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;${t0.toFixed(4)};${(t0 + 0.02).toFixed(4)};${(t0 + 0.07).toFixed(4)};1" dur="${DUR}s" fill="freeze"/>
      <animateTransform attributeName="transform" type="scale" additive="sum" values="0.2;0.2;1.25;0.4;0.4" keyTimes="0;${t0.toFixed(4)};${(t0 + 0.02).toFixed(4)};${(t0 + 0.07).toFixed(4)};1" dur="${DUR}s" fill="freeze"/>
      <path d="M0,-11 Q1.6,-1.6 11,0 Q1.6,1.6 0,11 Q-1.6,1.6 -11,0 Q-1.6,-1.6 0,-11Z" fill="#f8dc62"/>
    </g>`;
      })
      .join("\n    ")}

    <!-- Sneaky cat: walks in, checks both sides, pulls the cord, then slips out the bottom -->
    <g transform="translate(${catX},${catY})">
      <g filter="url(#cat-glow)">
        <animateTransform attributeName="transform" type="translate"
          values="150 0;0 0;0 0;0 0;0 0;0 14;0 0;0 0;0 0;0 240"
          keyTimes="0;${K.walkedIn};${K.planted};${K.lookAEnd};${K.grabbed};${K.yankEnd};${K.released};${K.blindUp};${K.lookBEnd};1"
          dur="${DUR}s" fill="freeze" calcMode="spline"
          keySplines="0.25 0.1 0.25 1;0.4 0 0.2 1;0 0 1 1;0 0 1 1;0.5 0 0.9 0.4;0.2 0.9 0.3 1;0 0 1 1;0 0 1 1;0.42 0 0.7 0.55"/>

        <ellipse cx="0" cy="-2" rx="48" ry="10" fill="url(#cat-shadow)"/>

        <g>
          <animateTransform attributeName="transform" type="rotate" values="0 -22 -24;7 -22 -24;-6 -22 -24;0 -22 -24" keyTimes="0;0.33;0.7;1" dur="2.4s" repeatCount="indefinite"/>
          <path d="M-22,-24 C-52,-26 -66,-58 -46,-76" fill="none" stroke="#17171a" stroke-width="13" stroke-linecap="round"/>
          <circle cx="-46" cy="-76" r="7" fill="#26262c"/>
        </g>

        <ellipse cx="-17" cy="-8" rx="15" ry="9" fill="#17171a" stroke="#43434e" stroke-width="1.4"/>
        <ellipse cx="17" cy="-8" rx="15" ry="9" fill="#17171a" stroke="#43434e" stroke-width="1.4"/>
        <path d="M-26,-28 C-32,-64 -24,-90 0,-90 C24,-90 32,-64 26,-28 C22,-14 -22,-14 -26,-28 Z" fill="#17171a" stroke="#43434e" stroke-width="1.4"/>
        <ellipse cx="0" cy="-44" rx="14" ry="22" fill="#24242a"/>

        <!-- Front paws resting on the ground -->
        <g>
          <animate attributeName="opacity" values="1;1;0;0;1;1" keyTimes="0;${K.grabbed - 0.02};${K.grabbed};${K.letGo};${K.letGo + 0.02};1" dur="${DUR}s" fill="freeze"/>
          <path d="M-19,-70 C-27,-56 -27,-40 -23,-30" fill="none" stroke="#17171a" stroke-width="12" stroke-linecap="round"/>
          <path d="M19,-70 C27,-56 27,-40 23,-30" fill="none" stroke="#17171a" stroke-width="12" stroke-linecap="round"/>
          <ellipse cx="-23" cy="-26" rx="10" ry="7" fill="#1f1f25"/>
          <ellipse cx="23" cy="-26" rx="10" ry="7" fill="#1f1f25"/>
        </g>

        <!-- Raised paw gripping the cord -->
        <g opacity="0">
          <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;${K.grabbed - 0.02};${K.grabbed};${K.letGo};${K.letGo + 0.02};1" dur="${DUR}s" fill="freeze"/>
          <path d="M-19,-70 C-27,-56 -27,-40 -23,-30" fill="none" stroke="#17171a" stroke-width="12" stroke-linecap="round"/>
          <ellipse cx="-23" cy="-26" rx="10" ry="7" fill="#1f1f25"/>
          <path d="${armRest}" fill="none" stroke="#17171a" stroke-width="12" stroke-linecap="round">
            <animate attributeName="d" values="${armRest};${armRest};${armPull};${armPull};${armRest};${armRest}" keyTimes="0;${K.grabbed};${K.yankEnd};${K.released};${K.letGo};1" dur="${DUR}s" fill="freeze" calcMode="spline" keySplines="0 0 1 1;0.4 0 0.2 1;0 0 1 1;0.2 0.9 0.3 1;0 0 1 1"/>
          </path>
          <circle cx="46" cy="-116" r="9" fill="#1f1f25">
            <animate attributeName="cx" values="46;46;44;44;46;46" keyTimes="0;${K.grabbed};${K.yankEnd};${K.released};${K.letGo};1" dur="${DUR}s" fill="freeze"/>
            <animate attributeName="cy" values="-116;-116;-82;-82;-116;-116" keyTimes="0;${K.grabbed};${K.yankEnd};${K.released};${K.letGo};1" dur="${DUR}s" fill="freeze" calcMode="spline" keySplines="0 0 1 1;0.4 0 0.2 1;0 0 1 1;0.2 0.9 0.3 1;0 0 1 1"/>
          </circle>
        </g>

        <!-- Head: turns left, then right, before and after the pull -->
        <g>
          <animateTransform attributeName="transform" type="rotate" values="${headTurn}" keyTimes="${lookTimes}" dur="${DUR}s" fill="freeze"/>

          <g>
            <animateTransform attributeName="transform" type="rotate" values="0 -25 -126;0 -25 -126;-11 -25 -126;4 -25 -126;0 -25 -126" keyTimes="0;0.86;0.9;0.94;1" dur="3.7s" repeatCount="indefinite"/>
            <path d="M-25,-126 L-31,-153 L-6,-136 Z" fill="#17171a"/>
            <path d="M-23,-129 L-26,-146 L-12,-136 Z" fill="#d98a86"/>
          </g>
          <path d="M25,-126 L31,-153 L6,-136 Z" fill="#17171a"/>
          <path d="M23,-129 L26,-146 L12,-136 Z" fill="#d98a86"/>

          <circle cx="0" cy="-110" r="28" fill="#17171a" stroke="#43434e" stroke-width="1.4"/>
          <ellipse cx="-9" cy="-97" rx="11" ry="8" fill="#1f1f25"/>
          <ellipse cx="9" cy="-97" rx="11" ry="8" fill="#1f1f25"/>

          <line x1="-16" y1="-102" x2="-44" y2="-108" stroke="#efe6cf" stroke-width="1.3" opacity="0.75"/>
          <line x1="-16" y1="-98" x2="-46" y2="-97" stroke="#efe6cf" stroke-width="1.3" opacity="0.75"/>
          <line x1="-16" y1="-94" x2="-44" y2="-87" stroke="#efe6cf" stroke-width="1.3" opacity="0.75"/>
          <line x1="16" y1="-102" x2="44" y2="-108" stroke="#efe6cf" stroke-width="1.3" opacity="0.75"/>
          <line x1="16" y1="-98" x2="46" y2="-97" stroke="#efe6cf" stroke-width="1.3" opacity="0.75"/>
          <line x1="16" y1="-94" x2="44" y2="-87" stroke="#efe6cf" stroke-width="1.3" opacity="0.75"/>

          <ellipse cx="-11" cy="-114" rx="8.5" ry="10" fill="#f8dc62"/>
          <ellipse cx="11" cy="-114" rx="8.5" ry="10" fill="#f8dc62"/>
          <g>
            <animateTransform attributeName="transform" type="translate" values="${eyeShift}" keyTimes="${lookTimes}" dur="${DUR}s" fill="freeze"/>
            <ellipse cx="-11" cy="-114" rx="3" ry="7.5" fill="#17171a"/>
            <ellipse cx="11" cy="-114" rx="3" ry="7.5" fill="#17171a"/>
            <circle cx="-13.5" cy="-118" r="1.8" fill="#fffdf2"/>
            <circle cx="8.5" cy="-118" r="1.8" fill="#fffdf2"/>
          </g>

          <path d="M-4,-101 L4,-101 L0,-96 Z" fill="#e0a3a3"/>
          <path d="M0,-96 Q-5,-91 -10,-94" fill="none" stroke="#9a9aa4" stroke-width="1.4" stroke-linecap="round"/>
          <path d="M0,-96 Q5,-91 10,-94" fill="none" stroke="#9a9aa4" stroke-width="1.4" stroke-linecap="round"/>

          <rect x="-26" y="-132" width="52" height="0" fill="#17171a">
            <animate attributeName="height" values="0;0;24;0;0" keyTimes="0;0.9;0.94;0.98;1" dur="4.1s" repeatCount="indefinite"/>
          </rect>
        </g>
      </g>
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
