#!/usr/bin/env node
/**
 * Self-hosted SVG profile cards for the GitHub README.
 * No dependency on github-readme-stats / Vercel — generated here and committed.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const USERNAME = process.env.GH_USERNAME || "DinonowDev";
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";

const THEME = {
  bg0: "#0d1117",
  bg1: "#1a1b26",
  bg2: "#24283b",
  border: "#292e42",
  text: "#c0caf5",
  muted: "#565f89",
  dim: "#414868",
  blue: "#7aa2f7",
  cyan: "#7dcfff",
  magenta: "#bb9af7",
  green: "#9ece6a",
  orange: "#ff9e64",
  red: "#f7768e",
  yellow: "#e0af68",
};

const HIDE_LANGS = new Set(["Vim Script", "Vim Snippet", "C", "Makefile", "Shell"]);

const QUERY = `
query ($login: String!) {
  user(login: $login) {
    name
    login
    bio
    location
    avatarUrl
    url
    followers { totalCount }
    following { totalCount }
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC) {
      totalCount
      nodes {
        stargazerCount
        forkCount
        languages(first: 12, orderBy: { field: SIZE, direction: DESC }) {
          edges { size node { name color } }
        }
      }
    }
    contributionsCollection {
      contributionCalendar { totalContributions }
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

async function fetchAvatarDataUri(url) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "dinonowdev-profile-cards" } });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get("content-type") || "image/png";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
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
      langColor.set(name, edge.node.color || THEME.blue);
    }
  }

  const totalBytes = [...langBytes.values()].reduce((a, b) => a + b, 0) || 1;
  const languages = [...langBytes.entries()]
    .map(([name, size]) => ({
      name,
      size,
      pct: (size / totalBytes) * 100,
      color: langColor.get(name),
    }))
    .sort((a, b) => b.size - a.size)
    .slice(0, 5);

  return {
    name: user.name || user.login,
    login: user.login,
    bio: (user.bio || "Front-end Developer").replace(/\r?\n/g, " ").trim(),
    location: user.location || "",
    avatarUrl: user.avatarUrl,
    followers: user.followers.totalCount,
    repos: user.repositories.totalCount,
    stars,
    forks,
    contributions: user.contributionsCollection.contributionCalendar.totalContributions,
    languages,
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

function icon(path, x, y, color) {
  return `<path transform="translate(${x},${y}) scale(0.82)" fill="${color}" d="${path}"/>`;
}

const ICONS = {
  star: "M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z",
  repo: "M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 11h8ZM4.5 1a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8V1Z",
  users:
    "M2 5.5a3.5 3.5 0 1 1 5.898 2.549 5.508 5.508 0 0 1 3.034 4.084.75.75 0 1 1-1.482.235 4.001 4.001 0 0 0-7.9 0 .75.75 0 0 1-1.482-.236A5.507 5.507 0 0 1 3.102 8.05 3.493 3.493 0 0 1 2 5.5ZM11 4a3.001 3.001 0 0 1 2.22 5.018 5.01 5.01 0 0 1 2.56 3.012.749.749 0 0 1-.885.954.752.752 0 0 1-.549-.514 3.507 3.507 0 0 0-2.522-2.372.75.75 0 0 1 .454-1.434A1.5 1.5 0 0 0 11 5.5a1.5 1.5 0 0 0 0-3Z",
  commit:
    "M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.32a.75.75 0 0 1 0 1.5Zm-1.43-.75a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z",
};

function statPill(x, y, w, label, value, color, iconPath) {
  return `
  <g transform="translate(${x},${y})">
    <rect width="${w}" height="70" rx="14" fill="${THEME.bg2}" fill-opacity="0.78" stroke="${THEME.border}"/>
    <rect width="3" height="70" rx="1.5" fill="${color}"/>
    ${icon(iconPath, 16, 14, color)}
    <text x="38" y="27" fill="${THEME.muted}" font-size="11" font-family="'Segoe UI', Ubuntu, Sans-Serif">${esc(label)}</text>
    <text x="16" y="54" fill="${THEME.text}" font-size="22" font-weight="700" font-family="'Segoe UI', Ubuntu, Sans-Serif">${esc(value)}</text>
  </g>`;
}

function buildProfileSvg(data, avatarDataUri) {
  const W = 860;
  const H = 280;
  const updated = new Date().toISOString().slice(0, 10);
  const barW = W - 64;

  let stacked = "";
  let legend = "";
  let offset = 0;
  data.languages.forEach((lang, i) => {
    const w = Math.max(3, (lang.pct / 100) * barW);
    stacked += `<rect x="${offset}" y="0" width="${w}" height="10" fill="${lang.color}"/>`;
    offset += w;
    const lx = 32 + i * 158;
    legend += `
    <g transform="translate(${lx},248)">
      <circle cx="5" cy="0" r="4.5" fill="${lang.color}"/>
      <text x="15" y="4" fill="${THEME.text}" font-size="12" font-family="'Segoe UI', Ubuntu, Sans-Serif">${esc(lang.name)} <tspan fill="${THEME.muted}">${lang.pct.toFixed(1)}%</tspan></text>
    </g>`;
  });

  const avatar = avatarDataUri
    ? `<image href="${avatarDataUri}" x="36" y="32" width="84" height="84" clip-path="url(#avatarClip)"/>`
    : `<circle cx="78" cy="74" r="42" fill="${THEME.bg2}"/>`;

  const pillW = 190;
  const gap = 16;
  const startX = 32;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title">
  <title id="title">${esc(data.name)} — GitHub Stats</title>
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${THEME.bg0}"/>
      <stop offset="50%" stop-color="${THEME.bg1}"/>
      <stop offset="100%" stop-color="#13131a"/>
    </linearGradient>
    <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${THEME.blue}"/>
      <stop offset="50%" stop-color="${THEME.magenta}"/>
      <stop offset="100%" stop-color="${THEME.cyan}"/>
    </linearGradient>
    <radialGradient id="orb" cx="12%" cy="0%" r="60%">
      <stop offset="0%" stop-color="${THEME.blue}" stop-opacity="0.28"/>
      <stop offset="45%" stop-color="${THEME.magenta}" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="${THEME.bg0}" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="avatarClip"><circle cx="78" cy="74" r="42"/></clipPath>
    <clipPath id="langClip"><rect width="${barW}" height="10" rx="5"/></clipPath>
  </defs>

  <rect width="${W}" height="${H}" rx="18" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" rx="18" fill="url(#orb)"/>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="17" fill="none" stroke="${THEME.border}"/>
  <rect width="${W}" height="3" fill="url(#glow)"/>

  <circle cx="78" cy="74" r="46" fill="none" stroke="url(#glow)" stroke-width="2.2" opacity="0.85"/>
  ${avatar}

  <text x="140" y="58" fill="${THEME.text}" font-size="26" font-weight="700" font-family="'Segoe UI', Ubuntu, Sans-Serif">${esc(data.name)}</text>
  <text x="140" y="82" fill="${THEME.blue}" font-size="14" font-family="'Segoe UI', Ubuntu, Sans-Serif">@${esc(data.login)}</text>
  <text x="140" y="106" fill="${THEME.muted}" font-size="13" font-family="'Segoe UI', Ubuntu, Sans-Serif">${esc(data.bio)}${data.location ? `  ·  ${esc(data.location)}` : ""}</text>

  ${statPill(startX, 130, pillW, "Total Stars", fmt(data.stars), THEME.yellow, ICONS.star)}
  ${statPill(startX + (pillW + gap), 130, pillW, "Repositories", fmt(data.repos), THEME.blue, ICONS.repo)}
  ${statPill(startX + 2 * (pillW + gap), 130, pillW, "Followers", fmt(data.followers), THEME.magenta, ICONS.users)}
  ${statPill(startX + 3 * (pillW + gap), 130, pillW, "Contributions", fmt(data.contributions), THEME.green, ICONS.commit)}

  <g transform="translate(32,220)">
    <g clip-path="url(#langClip)">${stacked}</g>
  </g>
  ${legend}

  <text x="${W - 32}" y="${H - 8}" text-anchor="end" fill="${THEME.dim}" font-size="9" font-family="'Segoe UI', Ubuntu, Sans-Serif">self-hosted · ${updated}</text>
</svg>
`;
}

function buildLangsSvg(data) {
  const W = 380;
  const H = 210;
  const barMax = 300;
  let rows = "";
  let stacked = "";
  let offset = 0;

  data.languages.forEach((lang, i) => {
    const y = 52 + i * 26;
    const w = Math.max(6, (lang.pct / 100) * barMax);
    const sw = Math.max(2, (lang.pct / 100) * (W - 48));
    stacked += `<rect x="${offset}" y="0" width="${sw}" height="10" fill="${lang.color}"/>`;
    offset += sw;
    rows += `
    <g transform="translate(24,${y})">
      <circle cx="5" cy="0" r="5" fill="${lang.color}"/>
      <text x="18" y="4" fill="${THEME.text}" font-size="13" font-family="'Segoe UI', Ubuntu, Sans-Serif">${esc(lang.name)}</text>
      <text x="${barMax}" y="4" text-anchor="end" fill="${THEME.muted}" font-size="12" font-family="'Segoe UI', Ubuntu, Sans-Serif">${lang.pct.toFixed(1)}%</text>
      <rect x="0" y="9" width="${barMax}" height="4" rx="2" fill="${THEME.bg0}"/>
      <rect x="0" y="9" width="${w}" height="4" rx="2" fill="${lang.color}"/>
    </g>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${THEME.bg0}"/>
      <stop offset="100%" stop-color="${THEME.bg1}"/>
    </linearGradient>
    <clipPath id="c"><rect width="${W - 48}" height="10" rx="5"/></clipPath>
  </defs>
  <rect width="${W}" height="${H}" rx="14" fill="url(#bg)"/>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="13" fill="none" stroke="${THEME.border}"/>
  <text x="24" y="28" fill="${THEME.blue}" font-size="15" font-weight="700" font-family="'Segoe UI', Ubuntu, Sans-Serif">Most Used Languages</text>
  <g transform="translate(24,36)" clip-path="url(#c)">${stacked}</g>
  ${rows}
</svg>
`;
}

async function main() {
  console.log(`Fetching stats for @${USERNAME}...`);
  const user = await fetchUser();
  const data = aggregate(user);
  const avatarDataUri = await fetchAvatarDataUri(data.avatarUrl);

  await mkdir(join(ROOT, "assets"), { recursive: true });
  await writeFile(join(ROOT, "assets", "profile-card.svg"), buildProfileSvg(data, avatarDataUri));
  await writeFile(join(ROOT, "assets", "languages.svg"), buildLangsSvg(data));

  console.log("Wrote assets/profile-card.svg + assets/languages.svg");
  console.log(
    `stars:${data.stars} repos:${data.repos} followers:${data.followers} contrib:${data.contributions} forks:${data.forks}`,
  );
  console.log(data.languages.map((l) => `${l.name} ${l.pct.toFixed(1)}%`).join(" · "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
