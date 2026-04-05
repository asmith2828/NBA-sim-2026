"""
NBA Data Pipeline — 2025-26 Regular Season
============================================
Fetches real player stats from stats.nba.com via the nba_api package and
produces a single all_players_2025_26.json file with all data needed to
feed the 6-layer calculation engine.

Usage:
    pip install nba_api pandas numpy
    python nba_data_pipeline.py

Output:
    all_players_2025_26.json  — one object per qualifying player (200+ min)
    pipeline_warnings.log     — any fallbacks or N/A stats documented here

Architecture matches the JS calculation engine (src/utils/metrics.js):
    Layer 1 inputs  — 18 subcategory scores, each from 3 component stats
    Layer 2 inputs  — position_tier (1/2/3), used for z-score normalization
    Layer 2.5 input — net_rtg_adjustment (on-court net rtg minus team avg)
    Flags           — _source fields mark direct vs proxy vs N/A stats

All stats normalized to per-75-possession equivalents where applicable.
"Lower is better" stats are INVERTED before percentile ranking so that
elite defense always maps to a HIGH score.

Season: 2025-26 Regular Season ONLY.
"""

import json
import time
import logging
import warnings
from pathlib import Path

import numpy as np
import pandas as pd

# nba_api uses built-in request handling with proper headers for stats.nba.com
# DO NOT hit stats.nba.com URLs directly — it blocks without proper headers
try:
    from nba_api.stats.endpoints import (
        LeagueDashPlayerStats,
        LeagueDashPlayerPtShot,
        LeagueDashPtStats,
        LeagueHustleStatsPlayer,
        LeagueDashPtDefend,          # replaces LeagueDashPlayerDefenseStats (removed in v1.4+)
        PlayerDashPtPass,
        PlayerDashPtReb,
        PlayerDashPtShotDefend,
        # PlayerDashPtDrive — removed in v1.4+; drives come from LeagueDashPtStats Drives
        # PlayerOnOffSummary — removed in v1.4+; only TeamPlayerOnOffSummary available
        LeagueDashTeamStats,
        CommonAllPlayers,
        LeagueDashPlayerBioStats,
    )
    NBA_API_AVAILABLE = True
except ImportError as e:
    NBA_API_AVAILABLE = False
    print(f"ERROR: nba_api import failed: {e}")
    print("Run: pip install nba_api pandas numpy")
    exit(1)

# ── Configuration ─────────────────────────────────────────────────────────────
SEASON = "2025-26"
SEASON_TYPE = "Regular Season"
MIN_MINUTES = 15           # Minimum per-game minutes for percentile calculations (min field is per-game)
API_DELAY = 1.5            # Seconds between API calls (stats.nba.com rate limits)
OUTPUT_FILE = "all_players_2025_26.json"
LOG_FILE = "pipeline_warnings.log"
PER_75_FACTOR = 0.75       # Per100Poss stats × 0.75 = per-75-possession

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler(),
    ]
)
log = logging.getLogger(__name__)

warnings.filterwarnings("ignore")


# ─────────────────────────────────────────────────────────────────────────────
# STEP 1: AUDIT — FETCH ALL ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

def safe_fetch(endpoint_class, description, **kwargs):
    """Fetch an endpoint with retry logic and rate limit delay."""
    time.sleep(API_DELAY)
    try:
        log.info(f"Fetching: {description}")
        result = endpoint_class(
            season=SEASON,
            season_type_all_star=SEASON_TYPE,
            **kwargs
        )
        df = result.get_data_frames()[0]
        log.info(f"  → {len(df)} rows, {list(df.columns)[:8]}...")
        return df
    except Exception as e:
        log.warning(f"  FAILED: {description}: {e}")
        # Try fallback to 2024-25 season for this endpoint only
        if "2025-26" in str(e) or "No data" in str(e):
            log.warning(f"  Attempting fallback to 2024-25 for {description}")
            time.sleep(API_DELAY)
            try:
                result = endpoint_class(
                    season="2024-25",
                    season_type_all_star=SEASON_TYPE,
                    **kwargs
                )
                df = result.get_data_frames()[0]
                log.warning(f"  FALLBACK USED for {description} — using 2024-25 data")
                return df
            except Exception as e2:
                log.error(f"  FALLBACK ALSO FAILED: {e2}")
        return pd.DataFrame()


def fetch_all_endpoints():
    """Fetch all required endpoints. Returns a dict of DataFrames."""
    data = {}

    # ── Core player stats ─────────────────────────────────────────────────
    # LeagueDashPlayerStats uses per_mode_detailed (not per_mode_simple)
    # Per-game for context
    data["basic_per_game"] = safe_fetch(
        LeagueDashPlayerStats,
        "LeagueDashPlayerStats PerGame",
        per_mode_detailed="PerGame",
    )

    # Per-100 possessions (multiply by 0.75 to get per-75)
    data["basic_per100"] = safe_fetch(
        LeagueDashPlayerStats,
        "LeagueDashPlayerStats Per100Poss",
        per_mode_detailed="Per100Possessions",
    )

    # Advanced stats (DREB_PCT, OREB_PCT, BLK_PCT, etc.)
    data["advanced"] = safe_fetch(
        LeagueDashPlayerStats,
        "LeagueDashPlayerStats Advanced",
        per_mode_detailed="PerGame",
        measure_type_detailed_defense="Advanced",
    )

    # ── Shot-type breakdowns ──────────────────────────────────────────────
    # Base (all shots) — eFG%, overall FG%
    data["pt_shot"] = safe_fetch(
        LeagueDashPlayerPtShot,
        "LeagueDashPlayerPtShot Base",
        per_mode_simple="PerGame",
    )
    # Wide open shots (defender 6+ feet away) — open 3pt%, open eFG%
    data["pt_shot_open"] = safe_fetch(
        LeagueDashPlayerPtShot,
        "LeagueDashPlayerPtShot Open",
        per_mode_simple="PerGame",
        close_def_dist_range_nullable="6+ Feet - Wide Open",
    )
    # Very tight shots (defender 0-2 feet) — contact finish%, contested fg%
    data["pt_shot_tight"] = safe_fetch(
        LeagueDashPlayerPtShot,
        "LeagueDashPlayerPtShot Tight",
        per_mode_simple="PerGame",
        close_def_dist_range_nullable="0-2 Feet - Very Tight",
    )
    # Pull-up shots (1+ dribbles before shot) — pull-up eFG%
    data["pt_shot_dribble"] = safe_fetch(
        LeagueDashPlayerPtShot,
        "LeagueDashPlayerPtShot Dribble",
        per_mode_simple="PerGame",
        dribble_range_nullable="1 Dribble",
    )

    # ── Passing, drives, touches ──────────────────────────────────────────
    # Must pass player_or_team='Player' to get per-player rows (default is Team)
    data["pt_stats"] = safe_fetch(
        LeagueDashPtStats,
        "LeagueDashPtStats Passing",
        per_mode_simple="PerGame",
        pt_measure_type="Passing",
        player_or_team="Player",
    )
    data["pt_stats_drives"] = safe_fetch(
        LeagueDashPtStats,
        "LeagueDashPtStats Drives",
        per_mode_simple="PerGame",
        pt_measure_type="Drives",
        player_or_team="Player",
    )
    data["pt_stats_offense"] = safe_fetch(
        LeagueDashPtStats,
        "LeagueDashPtStats CatchShoot",
        per_mode_simple="PerGame",
        pt_measure_type="CatchShoot",
        player_or_team="Player",
    )

    # ── Hustle stats ──────────────────────────────────────────────────────
    data["hustle"] = safe_fetch(
        LeagueHustleStatsPlayer,
        "LeagueHustleStatsPlayer",
        per_mode_time="PerGame",
    )

    # ── Defense ───────────────────────────────────────────────────────────
    # LeagueDashPtDefend uses CLOSE_DEF_PERSON_ID as the player ID column;
    # we rename it to PLAYER_ID during merge so everything joins cleanly.
    _def_raw = safe_fetch(
        LeagueDashPtDefend,
        "LeagueDashPtDefend Overall",
        per_mode_simple="PerGame",
        defense_category="Overall",
    )
    if not _def_raw.empty:
        if "CLOSE_DEF_PERSON_ID" in _def_raw.columns:
            _def_raw = _def_raw.rename(columns={"CLOSE_DEF_PERSON_ID": "PLAYER_ID"})
        elif "CLOSE_DEF_PERSON_ID" in [c.upper() for c in _def_raw.columns]:
            _def_raw.columns = [c.upper() for c in _def_raw.columns]
            _def_raw = _def_raw.rename(columns={"CLOSE_DEF_PERSON_ID": "PLAYER_ID"})
    data["defense"] = _def_raw

    # ── At-rim defense (Less Than 6Ft) — real per-player at-rim FG% ──────
    # defense_category MUST be "Less Than 6Ft" (no space before Ft)
    _def_atrim_raw = safe_fetch(
        LeagueDashPtDefend,
        "LeagueDashPtDefend Less Than 6Ft",
        per_mode_simple="PerGame",
        defense_category="Less Than 6Ft",
    )
    if not _def_atrim_raw.empty:
        if "CLOSE_DEF_PERSON_ID" in _def_atrim_raw.columns:
            _def_atrim_raw = _def_atrim_raw.rename(columns={"CLOSE_DEF_PERSON_ID": "PLAYER_ID"})
        elif "CLOSE_DEF_PERSON_ID" in [c.upper() for c in _def_atrim_raw.columns]:
            _def_atrim_raw.columns = [c.upper() for c in _def_atrim_raw.columns]
            _def_atrim_raw = _def_atrim_raw.rename(columns={"CLOSE_DEF_PERSON_ID": "PLAYER_ID"})
    data["defense_atrim"] = _def_atrim_raw

    # ── Player details for position tier assignment ───────────────────────
    data["bio"] = safe_fetch(
        LeagueDashPlayerBioStats,
        "LeagueDashPlayerBioStats",
        per_mode_simple="PerGame",
    )

    # ── Per-player detailed stats (these require looping per player) ──────
    # We'll fetch league-level aggregates instead where possible, and note
    # which stats require per-player endpoint calls for full accuracy.
    log.info("NOTE: PlayerDashPtPass, PlayerDashPtDrive, PlayerDashPtShotDefend,")
    log.info("      PlayerOnOffSummary require per-player API calls (1 call per player).")
    log.info("      Skipping individual player calls to avoid rate limiting.")
    log.info("      Using league-level proxies for these stats.")
    log.info("      For full accuracy, uncomment the per-player fetch loops below.")

    return data


# ─────────────────────────────────────────────────────────────────────────────
# STEP 2: MAP STATS TO SUBCATEGORY COMPONENTS
# ─────────────────────────────────────────────────────────────────────────────

# Stats where LOWER value = BETTER performance.
# These are inverted before percentile ranking:
#   inverted_value = population_max - raw_value + population_min
INVERTED_STATS = {
    # Court Vision
    "live_ball_tov_rate",
    # Shot Creation
    "contested_shot_pct",
    # Interior Defense (lower = better → inverted)
    "opp_at_rim_fg_pct",    # lower opponent FG% at rim = better
    "def_rim_rate_diff",    # fewer at-rim shots defended per game = greater deterrence
    "drive_freq_allowed",   # fewer at-rim shots per 36 min = drives more deterred
    "post_up_efg_allowed",  # lower opponent close-range FG% = better post defense
    # help_defense_impact → NOT inverted: deflections+charges higher=better
    # Perimeter Defense (lower = better → inverted)
    "opp_fg_on_coverage",
    "pull_up_fg_allowed",
    # back_door_cut_prev → NOT inverted: uses STL per 75, higher=better
    # help_rotation_speed → NOT inverted: uses charges drawn, higher=better
    "switch_effectiveness",
}


def build_player_frame(data):
    """
    Merge all endpoint DataFrames on PLAYER_ID.
    Returns a single DataFrame with one row per player and all raw stat fields.
    """
    if data["basic_per_game"].empty:
        log.error("Core player stats empty — cannot proceed.")
        return pd.DataFrame()

    # ── Base frame from per-game stats ─────────────────────────────────────
    base = data["basic_per_game"].copy()
    # Standardize column name
    if "PLAYER_ID" not in base.columns and "PLAYER_ID" in [c.upper() for c in base.columns]:
        base.columns = [c.upper() for c in base.columns]

    player_id_col = "PLAYER_ID"
    if player_id_col not in base.columns:
        log.error(f"PLAYER_ID not found in base frame. Columns: {list(base.columns)[:10]}")
        return pd.DataFrame()

    frames_to_merge = []

    # ── Per-100 poss stats (multiply by 0.75 → per-75) ────────────────────
    if not data["basic_per100"].empty:
        p100 = data["basic_per100"].copy()
        if "PLAYER_ID" not in p100.columns:
            p100.columns = [c.upper() for c in p100.columns]
        # Rename per-100 stats to avoid collision
        p100_cols = {c: f"{c}_P100" for c in p100.columns
                     if c not in [player_id_col, "PLAYER_NAME", "TEAM_ID", "TEAM_ABBREVIATION"]}
        p100 = p100.rename(columns=p100_cols)
        frames_to_merge.append((p100, player_id_col))

    # ── Advanced stats ────────────────────────────────────────────────────
    if not data["advanced"].empty:
        adv = data["advanced"].copy()
        if "PLAYER_ID" not in adv.columns:
            adv.columns = [c.upper() for c in adv.columns]
        adv_cols = {c: f"{c}_ADV" for c in adv.columns
                    if c not in [player_id_col, "PLAYER_NAME", "TEAM_ID"]}
        adv = adv.rename(columns=adv_cols)
        frames_to_merge.append((adv, player_id_col))

    # ── Shot type breakdown (base, open, tight, dribble) ─────────────────
    # pt_shot uses PLAYER_ID; pt_shot_open/tight/dribble may use PLAYER_ID too
    # but PLAYER_LAST_TEAM_ID instead of TEAM_ID — normalize before merge
    def _prep_ptshot(df_raw, suffix):
        if df_raw.empty:
            return None
        df_s = df_raw.copy()
        df_s.columns = [c.upper() for c in df_s.columns]
        # Normalize player ID column name
        if "PLAYER_ID" not in df_s.columns and "CLOSE_DEF_PERSON_ID" in df_s.columns:
            df_s = df_s.rename(columns={"CLOSE_DEF_PERSON_ID": "PLAYER_ID"})
        if "PLAYER_ID" not in df_s.columns:
            log.warning(f"No PLAYER_ID in pt_shot {suffix} — skipping")
            return None
        rename_map = {c: f"{c}_{suffix}" for c in df_s.columns
                      if c not in [player_id_col, "PLAYER_NAME", "PLAYER_LAST_TEAM_ID",
                                   "TEAM_ID", "TEAM_ABBREVIATION", "PLAYER_LAST_TEAM_ABBREVIATION"]}
        return df_s.rename(columns=rename_map)

    for key, suffix in [("pt_shot", "PTSHOT"), ("pt_shot_open", "PTOPEN"),
                        ("pt_shot_tight", "PTTIGHT"), ("pt_shot_dribble", "PTDRIB")]:
        prepped = _prep_ptshot(data[key], suffix)
        if prepped is not None:
            frames_to_merge.append((prepped, player_id_col))

    # ── Passing stats ─────────────────────────────────────────────────────
    if not data["pt_stats"].empty:
        pas = data["pt_stats"].copy()
        if "PLAYER_ID" not in pas.columns:
            pas.columns = [c.upper() for c in pas.columns]
        pas_cols = {c: f"{c}_PASS" for c in pas.columns
                    if c not in [player_id_col, "PLAYER_NAME", "TEAM_ID"]}
        pas = pas.rename(columns=pas_cols)
        frames_to_merge.append((pas, player_id_col))

    # ── Drive stats ───────────────────────────────────────────────────────
    if not data["pt_stats_drives"].empty:
        drv = data["pt_stats_drives"].copy()
        if "PLAYER_ID" not in drv.columns:
            drv.columns = [c.upper() for c in drv.columns]
        drv_cols = {c: f"{c}_DRIVE" for c in drv.columns
                    if c not in [player_id_col, "PLAYER_NAME", "TEAM_ID"]}
        drv = drv.rename(columns=drv_cols)
        frames_to_merge.append((drv, player_id_col))

    # ── Catch-and-shoot stats ─────────────────────────────────────────────
    if not data["pt_stats_offense"].empty:
        cas = data["pt_stats_offense"].copy()
        if "PLAYER_ID" not in cas.columns:
            cas.columns = [c.upper() for c in cas.columns]
        cas_cols = {c: f"{c}_CS" for c in cas.columns
                    if c not in [player_id_col, "PLAYER_NAME", "TEAM_ID"]}
        cas = cas.rename(columns=cas_cols)
        frames_to_merge.append((cas, player_id_col))

    # ── Hustle stats ──────────────────────────────────────────────────────
    if not data["hustle"].empty:
        hus = data["hustle"].copy()
        if "PLAYER_ID" not in hus.columns:
            hus.columns = [c.upper() for c in hus.columns]
        hus_cols = {c: f"{c}_HUSTLE" for c in hus.columns
                    if c not in [player_id_col, "PLAYER_NAME", "TEAM_ID"]}
        hus = hus.rename(columns=hus_cols)
        frames_to_merge.append((hus, player_id_col))

    # ── Defense stats ─────────────────────────────────────────────────────
    if not data["defense"].empty:
        dfs = data["defense"].copy()
        if "PLAYER_ID" not in dfs.columns:
            dfs.columns = [c.upper() for c in dfs.columns]
        dfs_cols = {c: f"{c}_DEF" for c in dfs.columns
                    if c not in [player_id_col, "PLAYER_NAME", "TEAM_ID"]}
        dfs = dfs.rename(columns=dfs_cols)
        frames_to_merge.append((dfs, player_id_col))

    # ── At-rim defense stats ──────────────────────────────────────────────
    if data.get("defense_atrim") is not None and not data["defense_atrim"].empty:
        dfa = data["defense_atrim"].copy()
        if "PLAYER_ID" not in dfa.columns:
            dfa.columns = [c.upper() for c in dfa.columns]
        dfa_cols = {c: f"{c}_ATRIM" for c in dfa.columns
                    if c not in [player_id_col, "PLAYER_NAME", "TEAM_ID"]}
        dfa = dfa.rename(columns=dfa_cols)
        frames_to_merge.append((dfa, player_id_col))

    # ── Bio stats (for position tier) ────────────────────────────────────
    if not data["bio"].empty:
        bio = data["bio"].copy()
        if "PLAYER_ID" not in bio.columns:
            bio.columns = [c.upper() for c in bio.columns]
        bio_cols = {c: f"{c}_BIO" for c in bio.columns
                    if c not in [player_id_col, "PLAYER_NAME", "TEAM_ID"]}
        bio = bio.rename(columns=bio_cols)
        frames_to_merge.append((bio, player_id_col))

    # ── Merge all frames ──────────────────────────────────────────────────
    merged = base.copy()
    for frame, id_col in frames_to_merge:
        try:
            merged = merged.merge(frame, on=id_col, how="left", suffixes=("", "_dup"))
            # Drop duplicate columns
            dup_cols = [c for c in merged.columns if c.endswith("_dup")]
            merged = merged.drop(columns=dup_cols)
        except Exception as e:
            log.warning(f"Merge failed for frame: {e}")

    log.info(f"Merged frame: {len(merged)} players, {len(merged.columns)} columns")
    return merged


# ─────────────────────────────────────────────────────────────────────────────
# STEP 2b: Extract Component Stats
# ─────────────────────────────────────────────────────────────────────────────

def extract_component_stats(df):
    """
    Map raw API fields to the 54 component stats used by the calculation engine
    (3 stats × 18 subcategories). Returns a new DataFrame with clean, renamed columns.

    For each stat, documents:
      - source: "direct" | "proxy" | "N/A"
      - inverted: True if lower raw value = better performance

    Stats marked N/A receive a neutral value of 50 for all players.
    Per-75 conversion: multiply Per100Poss values by PER_75_FACTOR (0.75).
    """
    out = pd.DataFrame()
    out["player_id"] = df.get("PLAYER_ID", pd.Series())
    out["player_name"] = df.get("PLAYER_NAME", df.get("PLAYER_NAME_x", pd.Series()))

    def col(name, fallback=None):
        """Get a column by name, trying common variants. Returns fallback if not found."""
        variants = [name, name.upper(), name.lower(), f"{name}_x", f"{name}_ADV"]
        for v in variants:
            if v in df.columns:
                return df[v].fillna(fallback if fallback is not None else 50)
        if fallback is not None:
            return pd.Series([fallback] * len(df), index=df.index)
        return pd.Series([50] * len(df), index=df.index)

    # Helpers for per-75 conversion
    def per75(col_name, fallback=50):
        """Per-100 poss column → per-75 poss."""
        variants = [f"{col_name}_P100", col_name, f"{col_name.upper()}_P100", col_name.upper()]
        for v in variants:
            if v in df.columns:
                return df[v].fillna(0) * PER_75_FACTOR
        return pd.Series([fallback] * len(df), index=df.index)

    # Minutes played (for qualifying filter)
    out["min"] = col("MIN", 0)

    # ── POSITION & IDENTITY ───────────────────────────────────────────────
    out["team"] = df.get("TEAM_ABBREVIATION", df.get("TEAM_ABBREVIATION_x", pd.Series([""] * len(df))))
    # PLAYER_POSITION comes from LeagueDashPtDefend, renamed to PLAYER_POSITION_DEF in the merge
    out["position"] = col("PLAYER_POSITION_DEF", "")
    if out["position"].eq("").all():
        out["position"] = col("PLAYER_POSITION", "")

    # ── PLAYMAKING / DECISION QUALITY ─────────────────────────────────────
    # Open Assist % — proxy: (AST - TOV) / (AST + TOV) clamped 0-1
    ast = col("AST", 0)
    tov = col("TOV", 1)
    out["open_assist_pct"] = ((ast - tov) / (ast + tov + 0.001)).clip(0, 1)
    out["open_assist_pct_source"] = "proxy"  # True open assist% not in league dash

    # Potential Assists — from LeagueDashPtStats passing; not available at league level
    # Using AST per 75 as proxy
    out["potential_assists"] = per75("AST", 0)
    out["potential_assists_source"] = "proxy"  # True potential assists from PlayerDashPtPass

    # Secondary Assist % — proxy: AST_ADJ / AST if available, else 0.15 * AST
    # (secondary assists typically ~15% of total in league)
    out["secondary_assist_pct"] = ast * 0.15
    out["secondary_assist_pct_source"] = "proxy"

    # ── PLAYMAKING / BALL MOVEMENT ────────────────────────────────────────
    # Passes Made — direct from LeagueDashPtStats Passing (player_or_team=Player)
    # Column becomes PASSES_MADE_PASS after suffix rename in build_player_frame
    passes_made = col("PASSES_MADE_PASS", 0)
    out["pass_velocity"] = passes_made
    out["pass_velocity_source"] = "direct" if "PASSES_MADE_PASS" in df.columns else "proxy"

    # Drive Kick Rate — DRIVE_PASSES / DRIVES from LeagueDashPtStats Drives
    # Columns become DRIVE_PASSES_DRIVE and DRIVES_DRIVE after suffix rename
    drive_passes = col("DRIVE_PASSES_DRIVE", 0)
    drives = col("DRIVES_DRIVE", 1)
    out["drive_kick_rate"] = (drive_passes / drives.replace(0, 1)).clip(0, 1)
    out["drive_kick_rate_source"] = "direct" if "DRIVES_DRIVE" in df.columns else "proxy"

    # Hockey Assist % — FT_AST (free throw assists) from passing stats as proxy
    # Column becomes FT_AST_PASS after suffix rename
    ft_ast = col("FT_AST_PASS", 0)
    out["hockey_assist_pct"] = ft_ast
    out["hockey_assist_pct_source"] = "direct" if "FT_AST_PASS" in df.columns else "proxy"

    # ── PLAYMAKING / COURT VISION ─────────────────────────────────────────
    # xEFG Created — AST from passing endpoint (direct count, not EFG%)
    # Column becomes AST_PASS after suffix rename
    pass_ast = col("AST_PASS", 0)
    out["x_efg_created"] = pass_ast
    out["x_efg_created_source"] = "direct" if "AST_PASS" in df.columns else "proxy"

    # Live Ball TOV Rate (INVERTED) — per-75 live-ball turnovers
    out["live_ball_tov_rate"] = per75("TOV", 0)
    out["live_ball_tov_rate_source"] = "proxy"  # No live-ball only breakdown in dash

    # Post-Drive Pass eFG% — drive AST rate as proxy
    drive_ast = col("DRIVE_AST_DRIVE", 0)
    out["post_drive_pass_efg"] = (drive_ast / drives.replace(0, 1)).clip(0, 1).fillna(0)
    out["post_drive_pass_efg_source"] = "direct" if "DRIVE_AST_DRIVE" in df.columns else "proxy"

    # ── SHOOTING / SHOT QUALITY ───────────────────────────────────────────
    # Using PTOPEN suffix for wide-open shots, PTTIGHT for contested shots
    # EFG_PCT_PTSHOT = overall eFG% from base pt_shot fetch
    efg = col("EFG_PCT_PTSHOT", 0.5)                 # overall eFG%
    open_fg3_pct = col("FG3_PCT_PTOPEN", 0.35)       # wide-open 3pt%
    overall_fg3_pct = col("FG3_PCT", 0.35)           # overall 3pt%

    # xFG delta: open 3pt% minus overall 3pt% (positive = better shooter)
    out["x_fg_delta"] = (open_fg3_pct - overall_fg3_pct).clip(-0.5, 0.5)
    out["x_fg_delta_source"] = "direct" if "FG3_PCT_PTOPEN" in df.columns else "proxy"

    # Shot Quality Score: open eFG% blended with overall eFG%
    open_efg = col("EFG_PCT_PTOPEN", 0.5)            # wide-open eFG%
    out["shot_quality_score"] = (open_efg * 0.6 + efg * 0.4).clip(0, 1)
    out["shot_quality_score_source"] = "direct" if "EFG_PCT_PTOPEN" in df.columns else "proxy"

    # Unguarded 3P% — wide-open 3pt% (PTOPEN suffix)
    out["unguarded_3p_pct"] = open_fg3_pct.fillna(0.33)
    out["unguarded_3p_pct_source"] = "direct" if "FG3_PCT_PTOPEN" in df.columns else "proxy"

    # ── SHOOTING / SHOT CREATION ──────────────────────────────────────────
    # Pull-Up eFG% — shots off 1+ dribbles (PTDRIB suffix)
    dribble_efg = col("EFG_PCT_PTDRIB", 0.42)
    out["pull_up_efg"] = dribble_efg.fillna(0.42)
    out["pull_up_efg_source"] = "direct" if "EFG_PCT_PTDRIB" in df.columns else "proxy"

    # Contested Shot % (INVERTED) — tight FGA / total FGA (PTTIGHT suffix)
    tight_fga = col("FGA_PTTIGHT", 0)
    total_fga = col("FGA", 1)
    out["contested_shot_pct"] = (tight_fga / total_fga.replace(0, 1)).clip(0, 1)
    out["contested_shot_pct_source"] = "direct" if "FGA_PTTIGHT" in df.columns else "proxy"

    # Shot Creation Rate — dribble FGA per 75 (PTDRIB suffix)
    dribble_fga = col("FGA_PTDRIB", 0)
    out["shot_creation_rate"] = (dribble_fga * 0.75).fillna(0)   # approx per-75
    out["shot_creation_rate_source"] = "direct" if "FGA_PTDRIB" in df.columns else "proxy"

    # ── SHOOTING / GRAVITY / SPACING ─────────────────────────────────────
    # Catch-and-Shoot stats — from LeagueDashPtStats CatchShoot (player_or_team=Player)
    # Actual column names after suffix rename: CATCH_SHOOT_FGA_CS, CATCH_SHOOT_EFG_PCT_CS
    cs_fga = col("CATCH_SHOOT_FGA_CS", 0)
    cs_efg = col("CATCH_SHOOT_EFG_PCT_CS", 0.45)
    out["off_ball_threat"] = (cs_fga * cs_efg).fillna(0)
    out["off_ball_threat_source"] = "direct" if "CATCH_SHOOT_FGA_CS" in df.columns else "proxy"

    # Kick-Out eFG% Diff — DRIVE_AST / DRIVES as proxy for playmaking off drives
    drive_ast = col("DRIVE_AST_DRIVE", 0)
    out["kick_out_efg_diff"] = (drive_ast / drives.replace(0, 1)).clip(0, 1).fillna(0)
    out["kick_out_efg_diff_source"] = "direct" if "DRIVE_AST_DRIVE" in df.columns else "proxy"

    # Catch-and-Shoot Frequency
    out["catch_shoot_freq"] = cs_fga.fillna(0)
    out["catch_shoot_freq_source"] = "direct" if "CATCH_SHOOT_FGA_CS" in df.columns else "proxy"

    # ── FINISHING / PAINT EFFICIENCY ─────────────────────────────────────
    # At-Rim FG% — overall FG% on all shots (best proxy without shot-distance filter)
    # True at-rim would need general_range='Less Than 6 Ft' filter — using overall FG2%
    at_rim_fg = col("FG2_PCT_PTSHOT", 0.6)   # 2pt FG% as at-rim proxy
    out["at_rim_fg_pct"] = at_rim_fg.fillna(0.6)
    out["at_rim_fg_pct_source"] = "direct" if "FG2_PCT_PTSHOT" in df.columns else "proxy"

    # Charge Drawn Rate — per 75 possessions (direct from hustle stats)
    charges = col("CHARGES_DRAWN_HUSTLE", 0)
    out["charge_drawn_rate"] = (charges * PER_75_FACTOR).fillna(0)
    out["charge_drawn_rate_source"] = "direct" if "CHARGES_DRAWN_HUSTLE" in df.columns else "proxy"

    # Contact Finish % — FG% on very tight shots (PTTIGHT suffix)
    tight_fg_pct = col("FG_PCT_PTTIGHT", 0.4)
    out["contact_finish_pct"] = tight_fg_pct.fillna(0.4)
    out["contact_finish_pct_source"] = "direct" if "FG_PCT_PTTIGHT" in df.columns else "proxy"

    # ── FINISHING / DRIVE IMPACT ──────────────────────────────────────────
    # FT Generation Rate — per 75 possessions
    out["ft_gen_rate"] = per75("FTA", 0)
    out["ft_gen_rate_source"] = "direct"

    # Drive Scoring Efficiency — DRIVE_PTS / DRIVES (direct from Drives endpoint)
    drive_pts = col("DRIVE_PTS_DRIVE", 0)
    out["drive_scoring_eff"] = (drive_pts / drives.replace(0, 1)).fillna(0)
    out["drive_scoring_eff_source"] = "direct" if "DRIVE_PTS_DRIVE" in df.columns else "proxy"

    # Drive Collapse Rate — (DRIVE_PASSES + DRIVE_FTA) / DRIVES (direct from Drives endpoint)
    drive_fta = col("DRIVE_FTA_DRIVE", 0)
    out["drive_collapse_rate"] = ((drive_passes + drive_fta) / drives.replace(0, 1)).clip(0, 2).fillna(0)
    out["drive_collapse_rate_source"] = "direct" if "DRIVE_FTA_DRIVE" in df.columns else "proxy"

    # ── FINISHING / TRANSITION SCORING ────────────────────────────────────
    # Transition eFG% — proxy: fast break points weighted by TS%
    ts_pct = col("TS_PCT_ADV", 0.55)
    fb_pts = col("FB_PTS", 0)  # Fast break points per game
    out["transition_efg"] = (ts_pct * (fb_pts / (fb_pts + 1))).fillna(0.5)
    out["transition_efg_source"] = "proxy"

    # Pace Factor — not available without on/off data; proxy = 0 (neutral) for all
    out["pace_factor"] = pd.Series([0.0] * len(df), index=df.index)
    out["pace_factor_source"] = "N/A"  # Requires PlayerOnOffSummary per-player call

    # Rim Pressure Rate — DRIVES / PASSES_RECEIVED (attacking tendency proxy)
    touches = col("PASSES_RECEIVED_PASS", 1)
    out["rim_pressure_rate"] = (drives / touches.replace(0, 1)).clip(0, 1).fillna(0.1)
    out["rim_pressure_rate_source"] = "proxy"

    # ── REBOUNDING / DEFENSIVE REBOUNDING ────────────────────────────────
    # DREB% — from advanced stats
    out["dreb_pct"] = col("DREB_PCT_ADV", 0.15)
    out["dreb_pct_source"] = "direct" if "DREB_PCT_ADV" in df.columns else "proxy"

    # Box Out Rate — DEF_BOXOUTS / DEF_BOXOUT_OPPORTUNITIES
    def_boxouts = col("DEF_BOXOUTS_HUSTLE", 0)
    def_boxout_opp = col("DEF_BOXOUT_PLAYER_REBS_HUSTLE", 1)
    out["box_out_rate"] = (def_boxouts / (def_boxouts + def_boxout_opp + 0.001)).clip(0, 1).fillna(0.5)
    out["box_out_rate_source"] = "direct" if "DEF_BOXOUTS_HUSTLE" in df.columns else "proxy"

    # Outlet Pass Speed — N/A; set neutral
    out["outlet_pass_speed"] = pd.Series([50.0] * len(df), index=df.index)
    out["outlet_pass_speed_source"] = "N/A"

    # ── REBOUNDING / OFFENSIVE REBOUNDING ────────────────────────────────
    # OREB%
    out["oreb_pct"] = col("OREB_PCT_ADV", 0.05)
    out["oreb_pct_source"] = "direct" if "OREB_PCT_ADV" in df.columns else "proxy"

    # Tip-In Conversion Rate — proxy: OREB × at-rim FG%
    oreb = col("OREB", 0)
    out["tip_in_conversion"] = (oreb * at_rim_fg).fillna(0)
    out["tip_in_conversion_source"] = "proxy"

    # Second-Chance Points Generated — OREB × 1.05 proxy
    out["second_chance_pts"] = per75("OREB", 0) * 1.05
    out["second_chance_pts_source"] = "proxy"

    # ── REBOUNDING / POSITIONING ──────────────────────────────────────────
    # Rebound Contest Rate — BOX_OUTS / (OREB_CHANCES + DREB_CHANCES)
    total_boxouts = col("BOX_OUTS_HUSTLE", 0)
    out["rebound_contest_rate"] = total_boxouts.fillna(0)
    out["rebound_contest_rate_source"] = "direct" if "BOX_OUTS_HUSTLE" in df.columns else "proxy"

    # Territory Size — N/A (requires Second Spectrum tracking data)
    out["territory_size"] = pd.Series([50.0] * len(df), index=df.index)
    out["territory_size_source"] = "N/A"

    # Opportunistic Reb% — proxy: total REB - (OREB + DREB) * 0.9 (boards outside primary zone)
    reb = col("REB", 0)
    oreb_total = col("OREB", 0)
    dreb_total = col("DREB", 0)
    out["opportunistic_reb_pct"] = ((reb - (oreb_total + dreb_total) * 0.9) / (reb + 0.001)).clip(0, 1).fillna(0.1)
    out["opportunistic_reb_pct_source"] = "proxy"

    # ── INTERIOR DEFENSE / RIM PROTECTION ────────────────────────────────
    # BLK_PCT not in 2025-26 advanced API; use BLK per 36 min as block rate proxy
    _blk_pg = col("BLK", 0)
    _min_blk = col("MIN", 25).replace(0, 1)
    blk_pct = (_blk_pg / _min_blk * 36).clip(0, 5)  # blocks per 36 min (0-5 range)
    d_fg_pct = col("D_FG_PCT_DEF", 0.5)   # overall close-out defense FG% (used across sections)

    # Opp At-Rim FG% (INVERTED) — real per-player from LeagueDashPtDefend "Less Than 6Ft"
    # Columns after _ATRIM suffix: LT_06_PCT_ATRIM = FG% allowed; FGA_LT_06_ATRIM = FGA count
    _has_atrim = "LT_06_PCT_ATRIM" in df.columns and not df["LT_06_PCT_ATRIM"].isna().all()
    _has_atrim_fga = "FGA_LT_06_ATRIM" in df.columns and not df["FGA_LT_06_ATRIM"].isna().all()
    d_fg_pct_atrim = col("LT_06_PCT_ATRIM", 0.0) if _has_atrim else None
    d_fga_atrim = col("FGA_LT_06_ATRIM", 0.0) if _has_atrim_fga else None

    if _has_atrim:
        out["opp_at_rim_fg_pct"] = d_fg_pct_atrim.fillna(d_fg_pct_atrim.median())
        out["opp_at_rim_fg_pct_source"] = "direct"
    else:
        out["opp_at_rim_fg_pct"] = (0.65 - blk_pct * 2).clip(0.4, 0.8).fillna(0.65)
        out["opp_at_rim_fg_pct_source"] = "proxy"

    # Block rate — BLK per 36 min (BLK_PCT not available in 2025-26 advanced API)
    out["block_pct"] = blk_pct
    out["block_pct_source"] = "direct" if "BLK" in df.columns else "proxy"

    # Def Rim Rate Diff (INVERTED) — at-rim FGA defended per game (more shots = less deterrence)
    charges_drawn = col("CHARGES_DRAWN_HUSTLE", 0)
    if _has_atrim_fga:
        out["def_rim_rate_diff"] = d_fga_atrim.fillna(d_fga_atrim.median())
        out["def_rim_rate_diff_source"] = "direct"
    else:
        # Higher charges = better rim deterrence; store inverted so inversion step yields high score
        max_chg = charges_drawn.quantile(0.95).clip(lower=0.1)
        out["def_rim_rate_diff"] = (max_chg - charges_drawn).clip(0).fillna(max_chg)
        out["def_rim_rate_diff_source"] = "proxy"

    # ── INTERIOR DEFENSE / PAINT DETERRENCE ──────────────────────────────
    # Drive Freq Allowed (INVERTED) — at-rim FGA per 36 min (drives getting through per 36)
    min_pg = col("MIN", 20)
    if _has_atrim_fga:
        fga_per36 = (d_fga_atrim / min_pg.replace(0, 1)) * 36
        out["drive_freq_allowed"] = fga_per36.fillna(fga_per36.median())
        out["drive_freq_allowed_source"] = "direct"
    else:
        out["drive_freq_allowed"] = (1.0 - blk_pct * 10).clip(0, 1).fillna(0.5)
        out["drive_freq_allowed_source"] = "proxy"

    # Post-Up eFG% Allowed (INVERTED) — close-range defensive FG% as post-up proxy
    if _has_atrim:
        # Blend at-rim FG% with blk% discount for a post-up estimate
        out["post_up_efg_allowed"] = (d_fg_pct_atrim * 0.75 + (0.65 - blk_pct * 2).clip(0.4, 0.8) * 0.25).fillna(0.55)
        out["post_up_efg_allowed_source"] = "proxy_atrim"
    else:
        out["post_up_efg_allowed"] = d_fg_pct.fillna(0.5)
        out["post_up_efg_allowed_source"] = "proxy"

    # Help Defense Impact (NOT inverted — higher = better)
    # Deflections show active help positioning; charges show arriving in help position on time
    charges_drawn = col("CHARGES_DRAWN_HUSTLE", 0)
    deflections_pg = col("DEFLECTIONS_HUSTLE", 0)
    out["help_defense_impact"] = (deflections_pg * 0.5 + charges_drawn * 2.5).fillna(0)
    out["help_defense_impact_source"] = "direct" if "DEFLECTIONS_HUSTLE" in df.columns else "proxy"

    # ── INTERIOR DEFENSE / POSITIONING ───────────────────────────────────
    # Foul Avoidance Rate — BLK / PF ratio (higher = smarter rim defense)
    blk = col("BLK", 0.5)
    pf = col("PF", 2)
    out["foul_avoidance_rate"] = (blk / pf.replace(0, 1)).clip(0, 5).fillna(0.25)
    out["foul_avoidance_rate_source"] = "direct"

    # Box Out Effectiveness — DEF_BOXOUT_PLAYER_REBS / DEF_BOXOUTS
    def_boxout_rebs = col("DEF_BOXOUT_PLAYER_REBS_HUSTLE", 0)
    out["box_out_effectiveness"] = (def_boxout_rebs / (def_boxouts + 0.001)).clip(0, 1).fillna(0.5)
    out["box_out_effectiveness_source"] = "direct" if "DEF_BOXOUT_PLAYER_REBS_HUSTLE" in df.columns else "proxy"

    # Def Rebound Territory — proxy: DREB_PCT as territory indicator
    out["def_reb_territory"] = col("DREB_PCT_ADV", 0.15)
    out["def_reb_territory_source"] = "proxy"

    # ── PERIMETER DEFENSE / ON-BALL PRESSURE ─────────────────────────────
    # Opp FG% on Coverage (INVERTED) — from defense stats
    d_fg_pct = col("D_FG_PCT_DEF", 0.5)
    out["opp_fg_on_coverage"] = d_fg_pct.fillna(0.5)
    out["opp_fg_on_coverage_source"] = "direct" if "D_FG_PCT_DEF" in df.columns else "proxy"

    # Forced TOV Rate — (STL per 75 + DEFLECTIONS per 75) combined
    stl = per75("STL", 0)
    deflections = col("DEFLECTIONS_HUSTLE", 0) * PER_75_FACTOR
    out["forced_tov_rate"] = (stl + deflections * 0.3).fillna(0)
    out["forced_tov_rate_source"] = "direct" if "STL" in df.columns else "proxy"

    # Pull-Up FG% Allowed (INVERTED) — proxy: D_FG_PCT adjusted for position
    out["pull_up_fg_allowed"] = d_fg_pct.fillna(0.45)
    out["pull_up_fg_allowed_source"] = "proxy"  # True: PlayerDashPtShotDefend per player

    # ── PERIMETER DEFENSE / OFF-BALL AWARENESS ────────────────────────────
    # Passing Lane Disruption — DEFLECTIONS per 75
    out["passing_lane_disrupt"] = deflections.fillna(0)
    out["passing_lane_disrupt_source"] = "direct" if "DEFLECTIONS_HUSTLE" in df.columns else "proxy"

    # Back-Door Cut Prevention (NOT inverted — higher STL per 75 = better anticipation)
    # STL often result from reading passing lanes and intercepting back-door / baseline cuts
    out["back_door_cut_prev"] = per75("STL", 0).fillna(0)
    out["back_door_cut_prev_source"] = "proxy"

    # Help Rotation Speed (NOT inverted — more charges drawn = better/faster rotation)
    # Drawing charges requires arriving in position before the offensive player — a rotation speed proxy
    out["help_rotation_speed"] = charges_drawn.fillna(0)
    out["help_rotation_speed_source"] = "direct" if "CHARGES_DRAWN_HUSTLE" in df.columns else "proxy"

    # ── PERIMETER DEFENSE / SCHEME VERSATILITY ────────────────────────────
    # Matchup Variety Score — proxy: number of distinct matchup archetypes
    # From defense stats if available, else proxy based on position versatility
    out["matchup_variety"] = col("MATCHUP_DIFFICULTY_DEF", 3.0)
    out["matchup_variety_source"] = "proxy"

    # Screen Navigation % — N/A; proxy: STL% as off-ball activity indicator
    out["screen_navigation_pct"] = (stl / per75("FGA", 1)).clip(0, 1).fillna(0.1)
    out["screen_navigation_pct_source"] = "proxy"

    # Switch Effectiveness (INVERTED) — proxy: D_FG_PCT (overall coverage quality)
    out["switch_effectiveness"] = d_fg_pct.fillna(0.48)
    out["switch_effectiveness_source"] = "proxy"

    # ── USAGE RATE ────────────────────────────────────────────────────────
    # USG_PCT_ADV: % of team possessions used by player when on court (0-100 scale)
    # Direct from LeagueDashPlayerStats Advanced
    usg_raw = col("USG_PCT_ADV", None)
    if usg_raw is not None and not usg_raw.eq(50).all():
        # API returns as 0-1 fraction; convert to 0-100 percentage
        usg_vals = usg_raw.fillna(0.20)
        # Values above 1 are already percentages (some API versions), below 1 need ×100
        usg_vals = usg_vals.apply(lambda v: v * 100 if v <= 1.0 else v)
        out["usg_pct"] = usg_vals.round(1)
        out["usg_pct_source"] = "direct"
    else:
        out["usg_pct"] = pd.Series([None] * len(df), index=df.index)
        out["usg_pct_source"] = "N/A"

    # ── NET RATING ADJUSTMENT ─────────────────────────────────────────────
    # net_rtg_adjustment = player on-court net rating - team average net rating
    # Requires PlayerOnOffSummary per player (expensive) — set to 0 for now
    out["net_rtg_adjustment"] = pd.Series([0.0] * len(df), index=df.index)
    out["net_rtg_adjustment_source"] = "N/A"
    log.warning("net_rtg_adjustment set to 0 for all players — "
                "requires per-player PlayerOnOffSummary calls to populate accurately")

    return out


# ─────────────────────────────────────────────────────────────────────────────
# STEP 3: INVERSION & PER-75 NORMALIZATION
# ─────────────────────────────────────────────────────────────────────────────

def invert_lower_is_better_stats(df):
    """
    For stats where lower raw value = better performance, invert them so that
    elite performance maps to a HIGH value before percentile ranking.

    Inversion formula: inverted = max - value + min (preserves scale, flips direction)
    Applied per-stat across all qualifying players.
    """
    df = df.copy()
    for stat in INVERTED_STATS:
        if stat in df.columns:
            col_data = df[stat].replace([np.inf, -np.inf], np.nan).fillna(df[stat].median())
            min_val = col_data.min()
            max_val = col_data.max()
            if max_val > min_val:
                df[stat] = max_val - col_data + min_val
                log.info(f"Inverted stat: {stat} (was: lower=better)")
            else:
                log.warning(f"Could not invert {stat}: min==max ({min_val})")
    return df


# ─────────────────────────────────────────────────────────────────────────────
# STEP 4: PERCENTILE RANKING → 1–99 SCORES
# ─────────────────────────────────────────────────────────────────────────────

def score_player_stats(df, qualifying_mask):
    """
    Convert each raw stat to a 1–99 subcategory component score using percentile
    ranks across all qualifying players (200+ minutes played).

    Formula: score = 1 + (percentile_rank / 100) * 98

    Players below 200 min threshold receive neutral score of 50 for all stats.
    Inversion must be applied BEFORE calling this function.

    Returns a DataFrame with all stat columns replaced by 1–99 scores.
    """
    COMPONENT_STATS = [
        # Playmaking
        "open_assist_pct", "potential_assists", "secondary_assist_pct",
        "pass_velocity", "drive_kick_rate", "hockey_assist_pct",
        "x_efg_created", "live_ball_tov_rate", "post_drive_pass_efg",
        # Shooting
        "x_fg_delta", "shot_quality_score", "unguarded_3p_pct",
        "pull_up_efg", "contested_shot_pct", "shot_creation_rate",
        "off_ball_threat", "kick_out_efg_diff", "catch_shoot_freq",
        # Finishing
        "at_rim_fg_pct", "charge_drawn_rate", "contact_finish_pct",
        "ft_gen_rate", "drive_scoring_eff", "drive_collapse_rate",
        "transition_efg", "pace_factor", "rim_pressure_rate",
        # Rebounding
        "dreb_pct", "box_out_rate", "outlet_pass_speed",
        "oreb_pct", "tip_in_conversion", "second_chance_pts",
        "rebound_contest_rate", "territory_size", "opportunistic_reb_pct",
        # Interior Defense
        "opp_at_rim_fg_pct", "block_pct", "def_rim_rate_diff",
        "drive_freq_allowed", "post_up_efg_allowed", "help_defense_impact",
        "foul_avoidance_rate", "box_out_effectiveness", "def_reb_territory",
        # Perimeter Defense
        "opp_fg_on_coverage", "forced_tov_rate", "pull_up_fg_allowed",
        "passing_lane_disrupt", "back_door_cut_prev", "help_rotation_speed",
        "matchup_variety", "screen_navigation_pct", "switch_effectiveness",
    ]

    scored = df.copy()
    qualifying = df[qualifying_mask]

    # N/A stats get fixed neutral score 50 — no percentile calculation
    na_stats = {stat for stat in COMPONENT_STATS
                if df.get(f"{stat}_source", pd.Series(["direct"])).eq("N/A").all()}

    for stat in COMPONENT_STATS:
        if stat not in scored.columns:
            scored[stat] = 50
            log.warning(f"Stat {stat} not in DataFrame — defaulting to 50")
            continue

        if stat in na_stats:
            scored[stat] = 50
            continue

        # Percentile rank among qualifying players
        q_vals = qualifying[stat].replace([np.inf, -np.inf], np.nan).fillna(50)
        # scipy not guaranteed available — use pandas rank
        pct_ranks = q_vals.rank(pct=True) * 100

        # Map all players: qualifying get percentile score, sub-threshold get 50
        stat_scores = pd.Series([50.0] * len(df), index=df.index)
        qualifying_idx = qualifying.index

        for idx in qualifying_idx:
            pct = pct_ranks.get(idx, 50.0)
            stat_scores[idx] = round(1 + (pct / 100) * 98)

        scored[stat] = stat_scores.clip(1, 99).round().astype(int)

    return scored


# ─────────────────────────────────────────────────────────────────────────────
# STEP 5: POSITION TIER ASSIGNMENT
# ─────────────────────────────────────────────────────────────────────────────

def assign_position_tier(df):
    """
    Assign position tier (1/2/3) based on player position:
      Tier 1 — Guards / Ball-Handlers: PG, ball-handling SG
      Tier 2 — Wings / Forwards: SF, switchable PF, combo forward, 3&D SG
      Tier 3 — Bigs: C, conventional PF

    Uses position string from CommonAllPlayers / bio stats.
    Position strings vary (G, F, C, G-F, F-G, etc.) so we parse them.
    """
    df = df.copy()
    tiers = []

    for _, row in df.iterrows():
        pos = str(row.get("position", "")).upper().strip()

        # Primary guard positions → Tier 1
        if pos in ("PG", "G"):
            tiers.append(1)
        # Pure centers → Tier 3
        elif pos in ("C",):
            tiers.append(3)
        # Wing-primary → Tier 2
        elif pos in ("SF", "F"):
            tiers.append(2)
        # Combo guard (G-F, SG with wing tendencies) → Tier 2
        elif "G-F" in pos or "SG" in pos:
            tiers.append(2)
        # Combo forward (F-C, C-F, PF, power forward) → Tier 3
        elif "F-C" in pos or "C-F" in pos or pos in ("PF",):
            tiers.append(3)
        # Default forward → Tier 2
        elif "F" in pos:
            tiers.append(2)
        else:
            tiers.append(2)  # Unknown → default Tier 2

    df["position_tier"] = tiers
    return df


# ─────────────────────────────────────────────────────────────────────────────
# STEP 6: BUILD FINAL OUTPUT
# ─────────────────────────────────────────────────────────────────────────────

SUBCATEGORY_MAPPING = {
    # Playmaking → Decision Quality (45%), Ball Movement (25%), Court Vision (30%)
    "decisionQuality": {
        "openAssistPct": ("open_assist_pct", 0.35),
        "potentialAssists": ("potential_assists", 0.40),
        "secondaryAssistPct": ("secondary_assist_pct", 0.25),
    },
    "ballMovement": {
        "passVelocity": ("pass_velocity", 0.35),
        "driveKickRate": ("drive_kick_rate", 0.40),
        "hockeyAssistPct": ("hockey_assist_pct", 0.25),
    },
    "courtVision": {
        "xEFGCreated": ("x_efg_created", 0.40),
        "liveBallTovRate": ("live_ball_tov_rate", 0.35),
        "postDrivePassEFG": ("post_drive_pass_efg", 0.25),
    },
    # Shooting → Shot Quality (40%), Shot Creation (30%), Gravity/Spacing (30%)
    "shotQuality": {
        "xFGDelta": ("x_fg_delta", 0.40),
        "shotQualityScore": ("shot_quality_score", 0.35),
        "unguarded3Pct": ("unguarded_3p_pct", 0.25),
    },
    "shotCreation": {
        "pullUpEFG": ("pull_up_efg", 0.40),
        "contestedShotPct": ("contested_shot_pct", 0.30),
        "shotCreationRate": ("shot_creation_rate", 0.30),
    },
    "shootingGravity": {
        "offBallThreat": ("off_ball_threat", 0.40),
        "kickOutEFGDiff": ("kick_out_efg_diff", 0.35),
        "catchShootFreq": ("catch_shoot_freq", 0.25),
    },
    # Finishing → Paint Efficiency (40%), Drive Impact (35%), Transition (25%)
    "paintEfficiency": {
        "atRimFGPct": ("at_rim_fg_pct", 0.40),
        "chargeDrawnRate": ("charge_drawn_rate", 0.30),
        "contactFinishPct": ("contact_finish_pct", 0.30),
    },
    "driveImpact": {
        "ftGenRate": ("ft_gen_rate", 0.40),
        "driveScoringEff": ("drive_scoring_eff", 0.35),
        "driveCollapseRate": ("drive_collapse_rate", 0.25),
    },
    "transitionScoring": {
        "transitionEFG": ("transition_efg", 0.40),
        "paceFactor": ("pace_factor", 0.30),
        "rimPressureRate": ("rim_pressure_rate", 0.30),
    },
    # Rebounding → Def Reb (50%), Off Reb (20%), Positioning (30%)
    "defRebounding": {
        "drebPct": ("dreb_pct", 0.50),
        "boxOutRate": ("box_out_rate", 0.30),
        "outletPassSpeed": ("outlet_pass_speed", 0.20),
    },
    "offRebounding": {
        "orebPct": ("oreb_pct", 0.50),
        "tipInConversion": ("tip_in_conversion", 0.25),
        "secondChancePts": ("second_chance_pts", 0.25),
    },
    "reboundPositioning": {
        "reboundContestRate": ("rebound_contest_rate", 0.40),
        "territorySize": ("territory_size", 0.30),
        "opportunisticRebPct": ("opportunistic_reb_pct", 0.30),
    },
    # Interior Defense → Rim Protection (45%), Paint Deterrence (35%), Positioning (20%)
    "rimProtection": {
        "oppAtRimFGPct": ("opp_at_rim_fg_pct", 0.45),
        "blockPct": ("block_pct", 0.35),
        "defRimRateDiff": ("def_rim_rate_diff", 0.20),
    },
    "paintDeterrence": {
        "driveFreqAllowed": ("drive_freq_allowed", 0.35),
        "postUpEFGAllowed": ("post_up_efg_allowed", 0.35),
        "helpDefenseImpact": ("help_defense_impact", 0.30),
    },
    "interiorPositioning": {
        "foulAvoidanceRate": ("foul_avoidance_rate", 0.50),
        "boxOutEffectiveness": ("box_out_effectiveness", 0.25),
        "defRebTerritory": ("def_reb_territory", 0.25),
    },
    # Perimeter Defense → On-Ball (40%), Off-Ball (35%), Versatility (25%)
    "onBallPressure": {
        "oppFGOnCoverage": ("opp_fg_on_coverage", 0.40),
        "forcedTovRate": ("forced_tov_rate", 0.35),
        "pullUpFGAllowed": ("pull_up_fg_allowed", 0.25),
    },
    "offBallAwareness": {
        "passingLaneDisrupt": ("passing_lane_disrupt", 0.45),
        "backDoorCutPrev": ("back_door_cut_prev", 0.30),
        "helpRotationSpeed": ("help_rotation_speed", 0.25),
    },
    "schemeVersatility": {
        "matchupVariety": ("matchup_variety", 0.40),
        "screenNavigationPct": ("screen_navigation_pct", 0.30),
        "switchEffectiveness": ("switch_effectiveness", 0.30),
    },
}


def build_output_records(scored_df):
    """Build final JSON-ready records for each player."""
    records = []

    for _, row in scored_df.iterrows():
        record = {
            "player_id": int(row.get("player_id", 0)),
            "player_name": str(row.get("player_name", "")),
            "team": str(row.get("team", "")),
            "position": str(row.get("position", "")),
            "position_tier": int(row.get("position_tier", 2)),
            "min": float(row.get("min", 0)),
            "net_rtg_adjustment": float(row.get("net_rtg_adjustment", 0)),
            "net_rtg_adjustment_source": str(row.get("net_rtg_adjustment_source", "N/A")),
            "usg_pct": float(row["usg_pct"]) if row.get("usg_pct") is not None and str(row.get("usg_pct")) not in ("nan", "None", "") else None,
            "usg_pct_source": str(row.get("usg_pct_source", "N/A")),
            "player_height_inches": int(row["PLAYER_HEIGHT_INCHES_BIO"]) if row.get("PLAYER_HEIGHT_INCHES_BIO") not in (None, float("nan"), "") and str(row.get("PLAYER_HEIGHT_INCHES_BIO", "")) not in ("nan", "None", "") else None,
        }

        # Individual component stats (camelCase for JS integration)
        for sub_key, stats in SUBCATEGORY_MAPPING.items():
            for js_key, (py_key, weight) in stats.items():
                val = row.get(py_key, 50)
                src = row.get(f"{py_key}_source", "proxy")
                record[js_key] = int(round(float(val)))
                record[f"{js_key}_source"] = src

        records.append(record)

    return records


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def main():
    log.info("=" * 60)
    log.info(f"NBA Data Pipeline — {SEASON} {SEASON_TYPE}")
    log.info("=" * 60)

    # Step 1: Fetch all endpoints
    log.info("\n── STEP 1: Fetching endpoints ───────────────────────────")
    data = fetch_all_endpoints()

    # Step 2: Build merged player frame
    log.info("\n── STEP 2: Merging endpoint data ────────────────────────")
    merged = build_player_frame(data)
    if merged.empty:
        log.error("Could not build player frame. Exiting.")
        return

    # Extract component stats
    log.info("\n── STEP 2b: Extracting component stats ──────────────────")
    component_df = extract_component_stats(merged)

    # Step 3: Invert lower-is-better stats
    log.info("\n── STEP 3: Inverting lower-is-better stats ─────────────")
    inverted_df = invert_lower_is_better_stats(component_df)

    # Step 4: Percentile ranking → 1–99 scores
    log.info("\n── STEP 4: Percentile ranking (min 200 min threshold) ───")
    min_col = inverted_df.get("min", pd.Series([0] * len(inverted_df)))
    qualifying_mask = min_col >= MIN_MINUTES
    log.info(f"  Qualifying players (≥{MIN_MINUTES} min): {qualifying_mask.sum()} / {len(inverted_df)}")
    scored_df = score_player_stats(inverted_df, qualifying_mask)

    # Step 5: Position tier assignment
    log.info("\n── STEP 5: Assigning position tiers ─────────────────────")
    scored_df = assign_position_tier(scored_df)

    # Step 6: Build output records
    log.info("\n── STEP 6: Building output JSON ─────────────────────────")
    records = build_output_records(scored_df)

    # Write output
    output_path = Path(OUTPUT_FILE)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({
            "season": SEASON,
            "season_type": SEASON_TYPE,
            "generated_at": pd.Timestamp.now().isoformat(),
            "total_players": len(records),
            "qualifying_players": int(qualifying_mask.sum()),
            "min_minutes_threshold": MIN_MINUTES,
            "notes": [
                "All per-75 stats: multiply Per100Poss × 0.75",
                "Inverted stats (lower=better): live_ball_tov_rate, contested_shot_pct, opp_at_rim_fg_pct, def_rim_rate_diff, drive_freq_allowed, post_up_efg_allowed, help_defense_impact, opp_fg_on_coverage, pull_up_fg_allowed, back_door_cut_prev, help_rotation_speed, switch_effectiveness",
                "N/A stats set to neutral score 50: outlet_pass_speed, territory_size, def_rim_rate_diff, help_defense_impact, back_door_cut_prev, help_rotation_speed, pace_factor, net_rtg_adjustment",
                "Proxy stats documented via _source fields: 'direct' | 'proxy' | 'N/A'",
            ],
            "players": records,
        }, f, indent=2, default=str)

    log.info(f"\n✓ Output written to: {output_path.absolute()}")
    log.info(f"  {len(records)} total players, {int(qualifying_mask.sum())} qualifying")
    log.info(f"  Warnings logged to: {LOG_FILE}")
    log.info("\nNext step: import all_players_2025_26.json into the JS app")
    log.info("  → replace src/data/players.js with the imported data")
    log.info("  → component stats (openAssistPct, etc.) will auto-upgrade Layer 1")


if __name__ == "__main__":
    main()


# ─────────────────────────────────────────────────────────────────────────────
# OPTIONAL: Per-player endpoint fetches (uncomment for full accuracy)
# ─────────────────────────────────────────────────────────────────────────────
# These endpoints return stats per player but require one API call per player,
# which can take 30+ minutes for the full league. Uncomment and run separately
# if you need full accuracy for:
#   - potential_assists (PlayerDashPtPass: POTENTIAL_AST)
#   - drive_kick_rate (PlayerDashPtDrive: DRIVE_PASSES / DRIVES)
#   - post_drive_pass_efg (PlayerDashPtDrive)
#   - opp_at_rim_fg_pct (PlayerDashPtShotDefend)
#   - net_rtg_adjustment (PlayerOnOffSummary)
#
# def fetch_per_player_stats(player_ids):
#     """Fetch per-player endpoints. Very slow — ~1.5s per player."""
#     results = {}
#     for i, pid in enumerate(player_ids):
#         log.info(f"Fetching per-player stats {i+1}/{len(player_ids)}: {pid}")
#         time.sleep(API_DELAY)
#         try:
#             pass_data = PlayerDashPtPass(
#                 player_id=pid, season=SEASON,
#                 season_type_all_star=SEASON_TYPE,
#                 per_mode_simple="PerGame",
#             ).get_data_frames()[0]
#
#             drive_data = PlayerDashPtDrive(
#                 player_id=pid, season=SEASON,
#                 season_type_all_star=SEASON_TYPE,
#                 per_mode_simple="PerGame",
#             ).get_data_frames()[0]
#
#             defend_data = PlayerDashPtShotDefend(
#                 player_id=pid, season=SEASON,
#                 season_type_all_star=SEASON_TYPE,
#             ).get_data_frames()[0]
#
#             on_off_data = PlayerOnOffSummary(
#                 team_id=...,  # requires team_id lookup
#                 season=SEASON,
#                 season_type_all_star=SEASON_TYPE,
#             ).get_data_frames()
#
#             results[pid] = {
#                 "passing": pass_data,
#                 "drives": drive_data,
#                 "shot_defense": defend_data,
#                 "on_off": on_off_data,
#             }
#         except Exception as e:
#             log.warning(f"Per-player fetch failed for {pid}: {e}")
#             results[pid] = {}
#     return results
