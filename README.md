### Hi there

**AmirHossein Rezaei** — Front-end Developer · Tehran

<p>
  <a href="https://t.me/dinonow"><img src="https://img.shields.io/badge/Telegram-dinonow-229ED9?style=flat-square&logo=telegram&logoColor=white" alt="Telegram" /></a>
  <a href="https://www.linkedin.com/in/dinonow"><img src="https://img.shields.io/badge/LinkedIn-dinonow-0A66C2?style=flat-square&logo=linkedin&logoColor=white" alt="LinkedIn" /></a>
  <a href="https://github.com/DinonowDev"><img src="https://img.shields.io/badge/GitHub-DinonowDev-181717?style=flat-square&logo=github&logoColor=white" alt="GitHub" /></a>
</p>

<p align="center">
  <img src="./assets/profile-card.svg?v=18" alt="GitHub profile overview" width="900" />
</p>

---

## Use this card on your own profile

This repo is a self-updating GitHub profile card: a dark bento SVG with live stats, an animated contribution panel, and a curtain intro (cat / Spider-Man / Batman).

You can fork it and run the same generator for **your** username.

### 1. Fork this repository

1. Open [DinonowDev/DinonowDev](https://github.com/DinonowDev/DinonowDev)
2. Click **Fork**
3. Make sure the forked repo is named exactly like your GitHub username  
   (`YourUsername/YourUsername`) so GitHub shows it as your [profile README](https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-github-profile/customizing-your-profile/managing-your-profile-readme)

If you already have a profile README repo, copy these instead:

- `scripts/generate-cards.mjs`
- `.github/workflows/update-stats.yml`
- `assets/` (optional starter SVGs)

### 2. Personalize the script

Edit `scripts/generate-cards.mjs`:

```js
const USERNAME = process.env.GH_USERNAME || "YourUsername";

const SOCIAL = {
  telegram: { handle: "@you", url: "https://t.me/you" },
  linkedin: { handle: "linkedin/in/you", url: "https://www.linkedin.com/in/you" },
  github: { handle: "github.com/YourUsername", url: "https://github.com/YourUsername" },
};
```

Also update the top of `README.md` (name, bio, badge links) and keep this embed:

```html
<p align="center">
  <img src="./assets/profile-card.svg" alt="GitHub profile overview" width="900" />
</p>
```

### 3. Point the workflow at your username

In `.github/workflows/update-stats.yml`, set:

```yaml
GH_USERNAME: YourUsername
```

`GITHUB_TOKEN` is provided automatically by Actions — you do not need a personal token for public stats.

### 4. Enable GitHub Actions

1. Open your fork → **Settings** → **Actions** → **General**
2. Allow Actions / allow workflows to create commits (needed so the job can push `assets/profile-card.svg`)
3. Run **Update Profile Stats** once from the **Actions** tab (**Run workflow**), or push a change to `scripts/generate-cards.mjs`

The workflow regenerates the SVG daily and on each push to those paths.

### 5. Pick a curtain theme (optional)

Create a repository variable:

**Settings → Secrets and variables → Actions → Variables**

| Name | Value |
| --- | --- |
| `CARD_THEME` | `cat`, `spiderman`, `batman`, or leave empty for random |

You can also pick a theme when running the workflow manually.

### Curtain theme examples

Same card, three openings:

<table>
  <tr>
    <td align="center"><strong>Cat</strong></td>
  </tr>
  <tr>
    <td>
      <img src="./assets/examples/cat.svg" alt="Profile card — cat curtain" width="900" />
    </td>
  </tr>
  <tr>
    <td align="center"><strong>Spider-Man</strong></td>
  </tr>
  <tr>
    <td>
      <img src="./assets/examples/spiderman.svg" alt="Profile card — Spider-Man curtain" width="900" />
    </td>
  </tr>
  <tr>
    <td align="center"><strong>Batman</strong></td>
  </tr>
  <tr>
    <td>
      <img src="./assets/examples/batman.svg" alt="Profile card — Batman curtain" width="900" />
    </td>
  </tr>
</table>

### What the metrics mean

| Metric | Meaning |
| --- | --- |
| **STARS** | Stars on **your** public (non-fork) repos |
| **REPOS** | Your public owned repos |
| **FOLLOWERS / FOLLOWING** | Your social counts |
| **CONTRIB REPOS** | Public repos you contributed to that you **do not** own |
| **OSS STARS** | Sum of stars on those contributed-to repos |

### Local generate (optional)

```bash
GH_USERNAME=YourUsername GITHUB_TOKEN=ghp_xxx CARD_THEME=cat node scripts/generate-cards.mjs
```

Needs network access to `api.github.com`.

### License / credit

Free to fork and adapt for your profile. A small credit link back to this repo is appreciated but not required.
