# NBA Player Effectiveness Dashboard

A React app for quantifying and comparing NBA player impact across 6 key metrics.

## Quick start

```bash
npm install
npm start
```

Opens at http://localhost:3000

---

## Project structure

```
src/
  data/
    players.js          # Mock player data (replace with API)
  utils/
    metrics.js          # Metric config, weights, normaliser functions
  components/
    MetricBars.jsx      # Reusable metric bar display
    PlayerCard.jsx      # Card used in Browse tab
    BrowseTab.jsx       # Search, filter, sort all players
    CompareTab.jsx      # Side-by-side two-player comparison
    LeadersTab.jsx      # Sortable leaderboard table
  App.jsx               # Root — tab state + compare state
  index.js              # React entry point
```

---

## The 6 metrics (0–100 scale)

| Metric | What it measures |
|---|---|
| Playmaking | Ball creation, assist rate, low turnovers |
| Shooting | True shooting efficiency (TS%) |
| Rebounding | Total rebounding volume per 36 min |
| Finishing | Scoring near the rim / points per attempt |
| Perimeter D | Steals, perimeter containment |
| Interior D | Blocks, interior deterrence |

### Effectiveness score

Weighted average of all 6 metrics. Default weights in `src/utils/metrics.js`:

```js
{ finishing: 0.20, playmaking: 0.18, shooting: 0.18,
  perimDef: 0.15, interiorDef: 0.15, rebounding: 0.14 }
```

Adjust weights freely — `calcEffectiveness()` recalculates automatically.

---

## Wiring the BallDontLie API

1. Sign up at https://www.balldontlie.io (free tier covers 2024-25 data; paid ~$9/mo for 2025-26 live)

2. In `src/data/players.js`, replace the `PLAYERS` array with a fetch:

```js
// Get player IDs first
// GET https://api.balldontlie.io/v1/players?search=jokic&per_page=5
// Authorization: YOUR_API_KEY

// Then fetch season averages
// GET https://api.balldontlie.io/v1/season_averages?season=2025&player_ids[]=279
```

3. Map the raw stats to 0–100 scores using the normalisers in `src/utils/metrics.js`:

```js
import {
  normPlaymaking, normShooting, normRebounding,
  normFinishing, normPerimDef, normInteriorDef
} from './utils/metrics';

const player = {
  id: raw.player.id,
  name: `${raw.player.first_name} ${raw.player.last_name}`,
  team: raw.team.abbreviation,
  pos: raw.player.position,
  playmaking:  normPlaymaking(raw.ast, raw.turnover, raw.min),
  shooting:    normShooting(raw.pts, raw.fga, raw.fta),
  rebounding:  normRebounding(raw.oreb, raw.dreb, raw.min),
  finishing:   normFinishing(raw.pts, raw.fga, raw.min),
  perimDef:    normPerimDef(raw.stl, raw.min),
  interiorDef: normInteriorDef(raw.blk, raw.dreb, raw.min),
};
```

4. Store the result in state and pass it into `<App>` in place of `PLAYERS_WITH_EFF`.

---

## Tuning the normalisers

The normaliser functions in `metrics.js` map raw stats to 0–100 by clamping against
a min/max range. Once you have real data, print out the league-wide distribution for
each stat and adjust the ranges so the best players land around 90–99 and average
players around 40–60.
