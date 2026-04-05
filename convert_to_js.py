"""
convert_to_js.py
================
Reads all_players_2025_26.json and generates:
  src/data/players.js  — all qualifying players in the format metrics.js expects
  src/data/teams.js    — all 30 NBA teams with auto-built starting lineups

Run after nba_data_pipeline.py:
    python3 convert_to_js.py
"""

import json
from pathlib import Path
from collections import defaultdict

# ── Input / Output ────────────────────────────────────────────────────────────
INPUT_JSON  = Path("all_players_2025_26.json")
OUT_PLAYERS = Path("src/data/players.js")
OUT_TEAMS   = Path("src/data/teams.js")
MIN_MINUTES = 15   # per-game minimum to include a player

# ── 30 NBA Teams ──────────────────────────────────────────────────────────────
TEAM_NAMES = {
    "ATL": "Atlanta Hawks",       "BKN": "Brooklyn Nets",
    "BOS": "Boston Celtics",      "CHA": "Charlotte Hornets",
    "CHI": "Chicago Bulls",       "CLE": "Cleveland Cavaliers",
    "DAL": "Dallas Mavericks",    "DEN": "Denver Nuggets",
    "DET": "Detroit Pistons",     "GSW": "Golden State Warriors",
    "HOU": "Houston Rockets",     "IND": "Indiana Pacers",
    "LAC": "LA Clippers",         "LAL": "Los Angeles Lakers",
    "MEM": "Memphis Grizzlies",   "MIA": "Miami Heat",
    "MIL": "Milwaukee Bucks",     "MIN": "Minnesota Timberwolves",
    "NOP": "New Orleans Pelicans","NYK": "New York Knicks",
    "OKC": "Oklahoma City Thunder","ORL": "Orlando Magic",
    "PHI": "Philadelphia 76ers",  "PHX": "Phoenix Suns",
    "POR": "Portland Trail Blazers","SAC": "Sacramento Kings",
    "SAS": "San Antonio Spurs",   "TOR": "Toronto Raptors",
    "UTA": "Utah Jazz",           "WAS": "Washington Wizards",
}

# ── Position Mapping ──────────────────────────────────────────────────────────
# NBA API position strings → PG/SG/SF/PF/C
POS_MAP = {
    "PG": "PG", "SG": "SG", "SF": "SF", "PF": "PF", "C": "C",
    "G":   None,   # resolved by tier below
    "F":   None,   # resolved by tier below
    "G-F": "SF",   # wing guard
    "F-G": "SG",   # wing forward (guard-leaning)
    "F-C": "PF",   # stretch 4 / undersized 5
    "C-F": "C",    # center who can play PF
}

def map_position(pos_str, tier):
    """Map NBA API position string + tier to PG/SG/SF/PF/C."""
    pos = pos_str.upper().strip()
    if pos in POS_MAP and POS_MAP[pos] is not None:
        return POS_MAP[pos]
    # Generic G or F — use tier to differentiate
    if "G" in pos:
        return "PG" if tier == 1 else "SG"
    if "F" in pos:
        return "SF" if tier <= 2 else "PF"
    # Fallback by tier
    if tier == 1: return "PG"
    if tier == 3: return "C"
    return "SF"

# ── Component stat keys to carry through from JSON ────────────────────────────
# These 54 keys match exactly what calcRawSubcategoryScores in metrics.js expects
COMPONENT_STAT_KEYS = [
    # Playmaking
    "openAssistPct", "potentialAssists", "secondaryAssistPct",
    "passVelocity", "driveKickRate", "hockeyAssistPct",
    "xEFGCreated", "liveBallTovRate", "postDrivePassEFG",
    # Shooting
    "xFGDelta", "shotQualityScore", "unguarded3Pct",
    "pullUpEFG", "contestedShotPct", "shotCreationRate",
    "offBallThreat", "kickOutEFGDiff", "catchShootFreq",
    # Finishing
    "atRimFGPct", "chargeDrawnRate", "contactFinishPct",
    "ftGenRate", "driveScoringEff", "driveCollapseRate",
    "transitionEFG", "paceFactor", "rimPressureRate",
    # Rebounding
    "drebPct", "boxOutRate", "outletPassSpeed",
    "orebPct", "tipInConversion", "secondChancePts",
    "reboundContestRate", "territorySize", "opportunisticRebPct",
    # Interior Defense
    "oppAtRimFGPct", "blockPct", "defRimRateDiff",
    "driveFreqAllowed", "postUpEFGAllowed", "helpDefenseImpact",
    "foulAvoidanceRate", "boxOutEffectiveness", "defRebTerritory",
    # Perimeter Defense
    "oppFGOnCoverage", "forcedTovRate", "pullUpFGAllowed",
    "passingLaneDisrupt", "backDoorCutPrev", "helpRotationSpeed",
    "matchupVariety", "screenNavigationPct", "switchEffectiveness",
]

# ── Load JSON ─────────────────────────────────────────────────────────────────
with open(INPUT_JSON) as f:
    raw = json.load(f)

all_raw = raw["players"]
qualifying = [p for p in all_raw if p.get("min", 0) >= MIN_MINUTES]
print(f"Loaded {len(qualifying)} qualifying players from {len(all_raw)} total")

# ── Convert Players ───────────────────────────────────────────────────────────
players = []
for i, p in enumerate(qualifying):
    tier = p.get("position_tier", 2)
    pos  = map_position(p.get("position", ""), tier)

    # Safety override: ensure tier is consistent with final mapped position.
    # Fixes pipeline edge cases where C-F / combo bigs get tier=2 incorrectly.
    if pos == 'C':
        tier = 3
    elif pos == 'PF' and tier < 2:
        tier = 2
    elif pos in ('PG', 'SG') and tier > 2:
        tier = 2

    player = {
        "id":               p["player_id"],
        "name":             p["player_name"],
        "team":             p["team"],
        "pos":              pos,
        "tier":             tier,
        "netRtgAdjustment": p.get("net_rtg_adjustment") or None,
        # USG% for EFF volume modifier (0-100 scale; None if not available)
        "usgPct":           round(float(p["usg_pct"]), 1) if p.get("usg_pct") is not None else None,
        # Minutes per game (used for realistic simulation minute distribution)
        "min":              round(float(p.get("min", 0)), 1),
        # Player height in inches (e.g. 78 = 6'6"); null if not available
        "heightInches":     int(p["player_height_inches"]) if p.get("player_height_inches") is not None else None,
    }
    # Attach all 54 component stats
    for key in COMPONENT_STAT_KEYS:
        player[key] = int(p.get(key, 50))

    players.append(player)

print(f"Converted {len(players)} players")

# ── Build Team Lineups ────────────────────────────────────────────────────────
# Group by team
by_team = defaultdict(list)
for p in players:
    by_team[p["team"]].append(p)

# Sort each team by minutes descending (higher min = more important player)
raw_min = {p["id"]: next((r["min"] for r in all_raw if r["player_id"] == p["id"]), 0) for p in players}
for team in by_team:
    by_team[team].sort(key=lambda p: raw_min.get(p["id"], 0), reverse=True)

POSITIONS = ["PG", "SG", "SF", "PF", "C"]
# Fallback assignment order when a position slot has no exact match
FALLBACK_ORDER = {
    "PG": ["SG", "SF", "PF", "C"],
    "SG": ["PG", "SF", "PF", "C"],
    "SF": ["SG", "PF", "PG", "C"],
    "PF": ["SF", "C", "SG", "PG"],
    "C":  ["PF", "SF", "SG", "PG"],
}

def build_lineup(team_players):
    """
    Assign the 5 best players to starting slots, 3 next to bench.
    Uses greedy position matching with fallback.
    """
    by_pos = defaultdict(list)
    for p in team_players:
        by_pos[p["pos"]].append(p)

    starters = {}
    used_ids = set()

    # First pass: fill each slot with best positional match
    for pos in POSITIONS:
        for candidate in by_pos[pos]:
            if candidate["id"] not in used_ids:
                starters[pos] = candidate["id"]
                used_ids.add(candidate["id"])
                break

    # Second pass: fill empty slots with fallback positions
    for pos in POSITIONS:
        if pos not in starters:
            for fallback_pos in FALLBACK_ORDER[pos]:
                for candidate in by_pos[fallback_pos]:
                    if candidate["id"] not in used_ids:
                        starters[pos] = candidate["id"]
                        used_ids.add(candidate["id"])
                        break
                if pos in starters:
                    break

    # Third pass: fill any remaining empty slots with highest-minute unused player
    for pos in POSITIONS:
        if pos not in starters:
            for p in team_players:
                if p["id"] not in used_ids:
                    starters[pos] = p["id"]
                    used_ids.add(p["id"])
                    break

    # Bench: next 5 players by minutes
    bench = []
    for p in team_players:
        if p["id"] not in used_ids and len(bench) < 5:
            bench.append(p["id"])
            used_ids.add(p["id"])

    # Pad bench to 5 with None if team has < 10 qualifying players
    while len(bench) < 5:
        bench.append(None)

    return starters, bench

teams = {}
for abbr, team_players in by_team.items():
    if abbr not in TEAM_NAMES:
        continue
    starters, bench = build_lineup(team_players)
    teams[abbr] = {
        "name":         TEAM_NAMES[abbr],
        "abbreviation": abbr,
        "starters":     starters,
        "bench":        bench,
    }

print(f"Built lineups for {len(teams)} teams")

# ── Write players.js ─────────────────────────────────────────────────────────
def js_value(v):
    if v is None:    return "null"
    if v is True:    return "true"
    if v is False:   return "false"
    if isinstance(v, str): return json.dumps(v)
    return str(v)

def player_to_js(p):
    lines = ["  {"]
    identity_keys = ["id", "name", "team", "pos", "tier", "netRtgAdjustment", "usgPct", "min", "heightInches"]
    for k in identity_keys:
        lines.append(f"    {k}: {js_value(p[k])},")
    # Component stats (grouped by subcategory for readability)
    groups = [
        ("// Playmaking", COMPONENT_STAT_KEYS[0:9]),
        ("// Shooting",   COMPONENT_STAT_KEYS[9:18]),
        ("// Finishing",  COMPONENT_STAT_KEYS[18:27]),
        ("// Rebounding", COMPONENT_STAT_KEYS[27:36]),
        ("// Interior D", COMPONENT_STAT_KEYS[36:45]),
        ("// Perimeter D",COMPONENT_STAT_KEYS[45:54]),
    ]
    for comment, keys in groups:
        vals = ", ".join(f"{k}: {p.get(k, 50)}" for k in keys)
        lines.append(f"    {vals}, {comment}")
    lines.append("  }")
    return "\n".join(lines)

players_js = "// AUTO-GENERATED by convert_to_js.py — do not edit manually\n"
players_js += f"// Source: all_players_2025_26.json (2025-26 NBA Regular Season)\n"
players_js += f"// {len(players)} qualifying players (≥{MIN_MINUTES} min/game)\n\n"
players_js += "export const PLAYERS = [\n"
players_js += ",\n".join(player_to_js(p) for p in players)
players_js += "\n];\n"

OUT_PLAYERS.write_text(players_js, encoding="utf-8")
print(f"Wrote {OUT_PLAYERS} ({len(players_js):,} bytes)")

# ── Write teams.js ────────────────────────────────────────────────────────────
def starters_to_js(s):
    parts = [f'{pos}: {s.get(pos, "null")}' for pos in POSITIONS]
    return "{ " + ", ".join(parts) + " }"

def bench_to_js(b):
    return "[" + ", ".join(str(x) if x is not None else "null" for x in b) + "]"

teams_js = "// AUTO-GENERATED by convert_to_js.py — do not edit manually\n"
teams_js += "// All 30 NBA teams with auto-built starting lineups (2025-26)\n\n"
teams_js += "export const NBA_TEAMS = {\n"
for abbr in sorted(teams.keys()):
    t = teams[abbr]
    teams_js += f"  '{abbr}': {{\n"
    teams_js += f"    name: {json.dumps(t['name'])},\n"
    teams_js += f"    abbreviation: '{abbr}',\n"
    teams_js += f"    starters: {starters_to_js(t['starters'])},\n"
    teams_js += f"    bench: {bench_to_js(t['bench'])},\n"
    teams_js += f"  }},\n"
teams_js += "};\n"

OUT_TEAMS.write_text(teams_js, encoding="utf-8")
print(f"Wrote {OUT_TEAMS} ({len(teams_js):,} bytes)")
print("\nDone. Now run the app — it will use real 2025-26 stats.")
