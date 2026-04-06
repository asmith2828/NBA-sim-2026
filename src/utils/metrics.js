/**
 * NBA Player Effectiveness Calculation Engine
 * ============================================================
 * 6-Layer Pipeline:
 *   Layer 1 — Raw subcategory scores (from component stats or direct input)
 *   Layer 2 — Z-score normalization by position tier (3 tiers, not 5 positions)
 *   Layer 2.5 — Net impact anchor (on-court net rating adjustment)
 *   Layer 3 — Subcategory → category weighted averages
 *   Layer 4 — EFF score (DIRECT subcategory weighted composite, 62–98 display)
 *   Layer 5 — Chemistry boosts (applied at subcategory level, L3+L4 recomputed)
 *   Layer 6 — Simulation weights (offensive + defensive, bench multiplier)
 *
 * Entry point: calculatePlayerEFF(player, allPlayers, chemistryBoosts?, isBench?)
 */

// ─── Name Utilities ───────────────────────────────────────────────────────────
const NAME_SUFFIXES = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v']);
export function lastName(name) {
  const parts = name.trim().split(' ');
  if (parts.length <= 1) return parts[0] || '';
  const lastLower = parts[parts.length - 1].toLowerCase();
  if (NAME_SUFFIXES.has(lastLower) && parts.length >= 3) {
    return parts.slice(1).join(' ');
  }
  return parts[parts.length - 1];
}

// ─── Position Tier Mapping ────────────────────────────────────────────────────
export const POSITION_TIER_DEFAULTS = {
  PG: 1,
  SG: 1,
  SF: 2,
  PF: 3,
  C:  3,
};

export function getPositionTier(player) {
  if (player.tier != null) return player.tier;
  return POSITION_TIER_DEFAULTS[player.pos] ?? 2;
}

// ─── INVERTED STATS ────────────────────────────────────────────────────────────
// Most inverted stats are stored as pre-converted percentile ranks (high = good for player).
// A small subset — RAW_INVERTED_STATS — are stored as raw directional values
// where LOW = good (e.g. defRimRateDiff: 4 means only 4% of rim attempts get through = elite).
// calcSubcategoryScore applies (100 - value) for these before scoring.
export const INVERTED_STATS = new Set([
  'liveBallTovRate',
  'contestedShotPct',
  'oppAtRimFGPct',
  'defRimRateDiff',
  'driveFreqAllowed',
  'postUpEFGAllowed',
  'helpDefenseImpact',
  'oppFGOnCoverage',
  'pullUpFGAllowed',
  'backDoorCutPrev',
  'helpRotationSpeed',
  'switchEffectiveness',
]);

// These specific stats are stored as raw directional values (low = better defense).
// All other inverted stats are already stored as percentile ranks (high = better).
const RAW_INVERTED_STATS = new Set(['defRimRateDiff', 'driveFreqAllowed']);

// ─── CATEGORY GROUPS ──────────────────────────────────────────────────────────
// Layer 4 note: `effSubWeight` on each subcategory replaces the old per-category
// `effWeight` for the EFF calculation. Subcategory weights sum to 1.00.
// `effWeight` is retained on categories for simulation weights (Layer 6) only.
export const CATEGORY_GROUPS = [
  // ── PLAYMAKING ───────────────────────────────────────────────────────────────
  {
    key: 'playmaking', label: 'Playmaking', color: '#3266ad',
    effWeight: 0.19, // retained for simulation Layer 6 only
    subcategories: [
      {
        key: 'decisionQuality', label: 'Decision Quality',
        effSubWeight: 0.10, // Highest single weight — smart decisions are the engine of offense
        weight: 0.45,
        description: 'Open Assist %, Potential Assists, Secondary Assist %',
        stats: [
          { key: 'openAssistPct',     label: 'Open Assist %',       weight: 0.35, inverted: false,
            description: '% of assists where recipient was open (defender 4+ ft away)',
            source: 'PlayerDashPtPass: OPEN_ASS_PCT; proxy: (AST-TOV)/(AST+TOV)' },
          { key: 'potentialAssists',  label: 'Potential Assists',   weight: 0.40, inverted: false,
            description: 'Passes that would be assists if the shot dropped',
            source: 'PlayerDashPtPass: POTENTIAL_AST (direct)' },
          { key: 'secondaryAssistPct',label: 'Secondary Assist %',  weight: 0.25, inverted: false,
            description: 'Contribution two passes before the shot',
            source: 'PlayerDashPtPass: SECONDARY_AST (direct)' },
        ],
      },
      {
        key: 'ballMovement', label: 'Ball Movement',
        effSubWeight: 0.06,
        weight: 0.25,
        description: 'Pass Velocity, Drive Kick Rate, Hockey Assist %',
        stats: [
          { key: 'passVelocity',    label: 'Pass Velocity',   weight: 0.35, inverted: false,
            description: 'Average ball speed after release',
            source: 'LeagueDashPtStats: AVG_PASS_DIST as proxy' },
          { key: 'driveKickRate',   label: 'Drive Kick Rate', weight: 0.40, inverted: false,
            description: 'How often a player kicks out to open shooters per drive',
            source: 'PlayerDashPtDrive: DRIVE_PASSES / DRIVES' },
          { key: 'hockeyAssistPct', label: 'Hockey Assist %', weight: 0.25, inverted: false,
            description: 'The pass before the assist',
            source: 'PlayerDashPtPass: AST_TO field' },
        ],
      },
      {
        key: 'courtVision', label: 'Court Vision',
        effSubWeight: 0.06,
        weight: 0.30,
        description: 'xEFG Created, Live Ball TOV Rate, Post-Drive Pass eFG%',
        stats: [
          { key: 'xEFGCreated',       label: 'xEFG Created',          weight: 0.40, inverted: false,
            description: 'Expected eFG% of shots generated for teammates via passes',
            source: 'PlayerDashPtPass: PASS_EFG' },
          { key: 'liveBallTovRate',    label: 'Live Ball TOV Rate',     weight: 0.35, inverted: true,
            description: 'Turnovers only on live-ball situations (LOWER IS BETTER)',
            source: 'LeagueDashPlayerStats: TOV per 75' },
          { key: 'postDrivePassEFG',  label: 'Post-Drive Pass eFG%',   weight: 0.25, inverted: false,
            description: 'Efficiency of teammate shots after a drive kick-out',
            source: 'PlayerDashPtDrive: DRIVE_PASS_EFG' },
        ],
      },
    ],
  },

  // ── SHOOTING ─────────────────────────────────────────────────────────────────
  {
    key: 'shooting', label: 'Shooting', color: '#E24B4A',
    effWeight: 0.20,
    subcategories: [
      {
        key: 'shotQuality', label: 'Shot Quality',
        effSubWeight: 0.09, // Pure efficiency — the end result of all shooting skill
        weight: 0.40,
        description: 'xFG% vs Actual FG%, Shot Quality Score, Unguarded 3P%',
        stats: [
          { key: 'xFGDelta',        label: 'xFG% vs Actual FG%',   weight: 0.40, inverted: false,
            description: 'Expected make rate vs actual',
            source: 'LeagueDashPlayerPtShot: actual eFG% minus xEFG estimate' },
          { key: 'shotQualityScore', label: 'Shot Quality Score',   weight: 0.35, inverted: false,
            description: 'Composite of defender distance, location, clock, type',
            source: 'LeagueDashPlayerPtShot: OPEN_FG3_PCT + DRIBBLE_FG_PCT' },
          { key: 'unguarded3Pct',   label: 'Unguarded 3P%',        weight: 0.25, inverted: false,
            description: '3P% when defender is 4+ feet away',
            source: 'LeagueDashPlayerPtShot: OPEN_FG3M / OPEN_FG3A' },
        ],
      },
      {
        key: 'shotCreation', label: 'Shot Creation',
        effSubWeight: 0.07, // Most scarce offensive skill
        weight: 0.30,
        description: 'Pull-Up eFG%, Contested Shot %, Shot Creation Rate',
        stats: [
          { key: 'pullUpEFG',          label: 'Pull-Up eFG%',        weight: 0.40, inverted: false,
            description: 'Efficiency on off-the-dribble shots',
            source: 'LeagueDashPlayerPtShot: DRIBBLE_EFG' },
          { key: 'contestedShotPct',   label: 'Contested Shot %',    weight: 0.30, inverted: true,
            description: '% of shots taken with a closing defender (LOWER IS BETTER)',
            source: 'LeagueDashPlayerPtShot: (TIGHT_FGA + VERY_TIGHT_FGA) / total FGA' },
          { key: 'shotCreationRate',   label: 'Shot Creation Rate',  weight: 0.30, inverted: false,
            description: 'Self-created shots per 75 possessions',
            source: 'LeagueDashPlayerPtShot: DRIBBLE_FGA per 75' },
        ],
      },
      {
        key: 'shootingGravity', label: 'Gravity / Spacing',
        effSubWeight: 0.04,
        weight: 0.30,
        description: 'Off-Ball Threat Score, Kick-Out eFG% Diff, C&S Frequency',
        stats: [
          { key: 'offBallThreat',    label: 'Off-Ball Threat Score',    weight: 0.40, inverted: false,
            description: 'Points scored or generated when NOT the ball handler',
            source: 'LeagueDashPtStats: OFF_BALL touches + catch-and-shoot eFG%' },
          { key: 'kickOutEFGDiff',   label: 'Kick-Out eFG% Diff',       weight: 0.35, inverted: false,
            description: 'Team eFG% on kick-out shots with player on vs off court',
            source: 'PlayerDashPtDrive: PASS_EFG on drive kick-outs' },
          { key: 'catchShootFreq',   label: 'C&S Frequency',            weight: 0.25, inverted: false,
            description: 'How often teammates find this player on off-ball movement',
            source: 'LeagueDashPlayerPtShot: CATCH_SHOOT_FGA frequency' },
        ],
      },
    ],
  },

  // ── FINISHING ─────────────────────────────────────────────────────────────────
  {
    key: 'finishing', label: 'Finishing', color: '#BA7517',
    effWeight: 0.20,
    subcategories: [
      {
        key: 'paintEfficiency', label: 'Paint Efficiency',
        effSubWeight: 0.08, // At-rim shots are the most valuable in basketball
        weight: 0.40,
        description: 'At-Rim FG%, Charge Drawn Rate, Contact Finish %',
        stats: [
          { key: 'atRimFGPct',      label: 'At-Rim FG%',          weight: 0.40, inverted: false,
            description: 'FG% on shots within 4 feet',
            source: 'LeagueDashPlayerPtShot: restricted area FG%' },
          { key: 'chargeDrawnRate', label: 'Charge Drawn Rate',    weight: 0.30, inverted: false,
            description: 'How often a player draws a charge or and-1 per drive',
            source: 'LeagueHustleStatsPlayer: CHARGES_DRAWN per 75' },
          { key: 'contactFinishPct',label: 'Contact Finish %',     weight: 0.30, inverted: false,
            description: 'FG% specifically when contact is made',
            source: 'LeagueDashPlayerPtShot: TIGHT_FG_PCT + VERY_TIGHT_FG_PCT' },
        ],
      },
      {
        key: 'driveImpact', label: 'Drive Impact',
        effSubWeight: 0.06,
        weight: 0.35,
        description: 'FT Generation Rate, Drive Scoring Efficiency, Drive Collapse Rate',
        stats: [
          { key: 'ftGenRate',        label: 'FT Generation Rate',    weight: 0.40, inverted: false,
            description: 'Free throws generated per 75 possessions',
            source: 'LeagueDashPlayerStats: FTA per 75' },
          { key: 'driveScoringEff',  label: 'Drive Scoring Eff',     weight: 0.35, inverted: false,
            description: 'Points per drive including kick-out assists',
            source: 'PlayerDashPtDrive: DRIVE_PTS / DRIVES' },
          { key: 'driveCollapseRate',label: 'Drive Collapse Rate',   weight: 0.25, inverted: false,
            description: '% of drives that force 2+ defenders out of position',
            source: 'PlayerDashPtDrive: (DRIVE_PASSES + DRIVE_FTA) / DRIVES' },
        ],
      },
      {
        key: 'transitionScoring', label: 'Transition Scoring',
        effSubWeight: 0.04,
        weight: 0.25,
        description: 'Transition eFG%, Pace Factor, Rim Pressure Rate',
        stats: [
          { key: 'transitionEFG',   label: 'Transition eFG%',    weight: 0.40, inverted: false,
            description: 'Efficiency in early-offense (first 6 seconds)',
            source: 'LeagueDashPlayerPtShot: fastbreak efficiency' },
          { key: 'paceFactor',      label: 'Pace Factor',         weight: 0.30, inverted: false,
            description: 'How much faster the game runs with this player on court',
            source: 'PlayerOnOffSummary: team pace on vs off delta' },
          { key: 'rimPressureRate', label: 'Rim Pressure Rate',   weight: 0.30, inverted: false,
            description: 'How often a player reaches the paint in transition',
            source: 'PlayerDashPtDrive: DRIVES / touches' },
        ],
      },
    ],
  },

  // ── REBOUNDING ───────────────────────────────────────────────────────────────
  {
    key: 'rebounding', label: 'Rebounding', color: '#1D9E75',
    effWeight: 0.12,
    subcategories: [
      {
        key: 'defRebounding', label: 'Def. Rebounding',
        effSubWeight: 0.06,
        weight: 0.50,
        description: 'DREB%, Box Out Rate, Outlet Pass Speed',
        stats: [
          { key: 'drebPct',         label: 'DREB%',               weight: 0.50, inverted: false,
            description: '% of available defensive rebounds captured',
            source: 'LeagueDashPlayerStats: DREB_PCT advanced' },
          { key: 'boxOutRate',      label: 'Box Out Rate',         weight: 0.30, inverted: false,
            description: 'Body contact to prevent opponent boards',
            source: 'LeagueHustleStatsPlayer: DEF_BOXOUTS / opportunities' },
          { key: 'outletPassSpeed', label: 'Outlet Pass Speed',    weight: 0.20, inverted: false,
            description: 'How quickly ball is pushed up after a DREB',
            source: 'N/A — proxy: DREB per 75 + fast break pts' },
        ],
      },
      {
        key: 'offRebounding', label: 'Off. Rebounding',
        effSubWeight: 0.02,
        weight: 0.20,
        description: 'OREB%, Tip-In Conversion Rate, Second-Chance Pts',
        stats: [
          { key: 'orebPct',           label: 'OREB%',                    weight: 0.50, inverted: false,
            description: '% of available offensive rebounds captured',
            source: 'LeagueDashPlayerStats: OREB_PCT advanced' },
          { key: 'tipInConversion',   label: 'Tip-In Conversion',        weight: 0.25, inverted: false,
            description: '% of offensive boards turned directly into scores',
            source: 'LeagueDashPlayerPtShot: putback FG%' },
          { key: 'secondChancePts',   label: 'Second-Chance Pts',        weight: 0.25, inverted: false,
            description: 'Points scored from offensive boards per 75',
            source: 'LeagueDashPlayerStats: second_chance_pts; proxy: OREB × 1.05' },
        ],
      },
      {
        key: 'reboundPositioning', label: 'Reb. Positioning',
        effSubWeight: 0.02,
        weight: 0.30,
        description: 'Rebound Contest Rate, Territory Size, Opportunistic Reb %',
        stats: [
          { key: 'reboundContestRate', label: 'Rebound Contest Rate', weight: 0.40, inverted: false,
            description: 'How often a player competes for available boards',
            source: 'LeagueHustleStatsPlayer: BOX_OUTS / (OREB + DREB chances)' },
          { key: 'territorySize',      label: 'Territory Size',       weight: 0.30, inverted: false,
            description: 'Spatial area covered on rebounds',
            source: 'N/A — not available; set neutral 50' },
          { key: 'opportunisticRebPct',label: 'Opportunistic Reb %',  weight: 0.30, inverted: false,
            description: 'Boards captured outside primary zone',
            source: 'PlayerDashPtReb: REB outside primary zone' },
        ],
      },
    ],
  },

  // ── INTERIOR DEFENSE ─────────────────────────────────────────────────────────
  {
    key: 'interiorDef', label: 'Interior D', color: '#D85A30',
    effWeight: 0.15,
    subcategories: [
      {
        key: 'rimProtection', label: 'Rim Protection',
        effSubWeight: 0.10, // Biggest deterrence effect — changes entire offensive strategy
        weight: 0.45,
        description: 'Opp At-Rim FG%, Block %, Def Rim Rate Differential',
        stats: [
          { key: 'oppAtRimFGPct',    label: 'Opp At-Rim FG%',        weight: 0.45, inverted: true,
            description: 'Opp FG% within 4 ft when nearest defender (LOWER IS BETTER)',
            source: 'PlayerDashPtShotDefend: FG_PCT at rim (direct, invert)' },
          { key: 'blockPct',         label: 'Block %',                weight: 0.35, inverted: false,
            description: '% of opponent 2-point attempts blocked per 75',
            source: 'LeagueDashPlayerStats: BLK_PCT advanced' },
          { key: 'defRimRateDiff',   label: 'Def Rim Rate Diff',      weight: 0.20, inverted: true,
            description: "Opponents' restricted area attempt frequency on vs off (LOWER IS BETTER)",
            source: 'PlayerOnOffSummary: opponent restricted area rate on vs off' },
        ],
      },
      {
        key: 'paintDeterrence', label: 'Paint Deterrence',
        effSubWeight: 0.04,
        weight: 0.35,
        description: 'Drive Freq Allowed, Post-Up eFG% Allowed, Help Defense Impact',
        stats: [
          { key: 'driveFreqAllowed',  label: 'Drive Freq Allowed',   weight: 0.35, inverted: true,
            description: 'How often opponents attack paint against this player (LOWER IS BETTER)',
            source: 'PlayerDashPtShotDefend: drives allowed per game' },
          { key: 'postUpEFGAllowed',  label: 'Post-Up eFG% Allowed', weight: 0.35, inverted: true,
            description: 'Opponent efficiency in post-up against this player (LOWER IS BETTER)',
            source: 'PlayerDashPtShotDefend: post-up FG% allowed' },
          { key: 'helpDefenseImpact', label: 'Help Defense Impact',  weight: 0.30, inverted: true,
            description: 'Team interior eFG% differential as help defender (LOWER IS BETTER)',
            source: 'PlayerOnOffSummary: team interior eFG% on vs off' },
        ],
      },
      {
        key: 'interiorPositioning', label: 'Interior Positioning',
        effSubWeight: 0.02,
        weight: 0.20,
        description: 'Foul Avoidance Rate, Box Out Effectiveness, Def Rebound Territory',
        stats: [
          { key: 'foulAvoidanceRate',  label: 'Foul Avoidance Rate',     weight: 0.50, inverted: false,
            description: 'Blocks-to-fouls ratio on shot challenges (higher = smarter)',
            source: 'LeagueDashPlayerStats: BLK / PF ratio' },
          { key: 'boxOutEffectiveness',label: 'Box Out Effectiveness',   weight: 0.25, inverted: false,
            description: 'How rarely opponents get offensive boards against this player',
            source: 'LeagueHustleStatsPlayer: DEF_BOXOUT_PLAYER_REBS / DEF_BOXOUTS' },
          { key: 'defRebTerritory',    label: 'Def Rebound Territory',   weight: 0.25, inverted: false,
            description: 'Spatial area covered on defensive rebounds',
            source: 'PlayerDashPtReb: rebound zone coverage' },
        ],
      },
    ],
  },

  // ── PERIMETER DEFENSE ────────────────────────────────────────────────────────
  {
    key: 'perimDef', label: 'Perimeter D', color: '#7F77DD',
    effWeight: 0.14,
    subcategories: [
      {
        key: 'onBallPressure', label: 'On-Ball Pressure',
        effSubWeight: 0.08, // Most visible and directly measurable defensive output
        weight: 0.40,
        description: 'Opp FG% on Coverage, Forced TOV Rate, Pull-Up FG% Allowed',
        stats: [
          { key: 'oppFGOnCoverage', label: 'Opp FG% on Coverage',  weight: 0.40, inverted: true,
            description: "Opponent eFG% when directly guarded (LOWER IS BETTER)",
            source: 'LeagueDashPlayerDefenseStats: D_FG_PCT (direct, invert)' },
          { key: 'forcedTovRate',   label: 'Forced TOV Rate',       weight: 0.35, inverted: false,
            description: 'Live-ball turnovers directly caused per 75 (higher = better)',
            source: 'LeagueDashPlayerStats: STL per 75 + deflections' },
          { key: 'pullUpFGAllowed', label: 'Pull-Up FG% Allowed',   weight: 0.25, inverted: true,
            description: "Opponent pull-up shooting % on-ball (LOWER IS BETTER)",
            source: 'PlayerDashPtShotDefend: pull-up FG% allowed' },
        ],
      },
      {
        key: 'offBallAwareness', label: 'Off-Ball Awareness',
        effSubWeight: 0.04,
        weight: 0.35,
        description: 'Passing Lane Disruption, Back-Door Cut Prevention, Help Rotation Speed',
        stats: [
          { key: 'passingLaneDisrupt', label: 'Passing Lane Disruption', weight: 0.45, inverted: false,
            description: 'Deflections + near-steals per 75 (higher = better)',
            source: 'LeagueHustleStatsPlayer: DEFLECTIONS per 75' },
          { key: 'backDoorCutPrev',    label: 'Back-Door Cut Prevention',weight: 0.30, inverted: true,
            description: 'Frequency off-ball cuts score when this player is nearest (LOWER IS BETTER)',
            source: 'N/A — proxy: opponent paint touches allowed; neutral 50' },
          { key: 'helpRotationSpeed',  label: 'Help Rotation Speed',     weight: 0.25, inverted: true,
            description: 'Average time from drive initiation to reaching paint (LOWER IS BETTER)',
            source: 'N/A — proxy: help defense on/off impact; neutral 50' },
        ],
      },
      {
        key: 'schemeVersatility', label: 'Scheme Versatility',
        effSubWeight: 0.02,
        weight: 0.25,
        description: 'Matchup Variety Score, Screen Navigation %, Switch Effectiveness',
        stats: [
          { key: 'matchupVariety',       label: 'Matchup Variety Score',  weight: 0.40, inverted: false,
            description: 'Number of distinct positional archetypes guarded per game',
            source: 'LeagueDashPlayerDefenseStats: distinct position archetypes guarded' },
          { key: 'screenNavigationPct',  label: 'Screen Navigation %',    weight: 0.30, inverted: false,
            description: 'How often a player fights through screens vs hedging',
            source: 'N/A — proxy: STL% + deflections on off-ball actions' },
          { key: 'switchEffectiveness',  label: 'Switch Effectiveness',   weight: 0.30, inverted: true,
            description: "Opponent eFG% when this player is switched onto (LOWER IS BETTER)",
            source: 'LeagueDashPlayerDefenseStats: D_FG_PCT when switched (invert)' },
        ],
      },
    ],
  },
];

// ─── Derived Constants ────────────────────────────────────────────────────────
export const ALL_SUBCATEGORY_KEYS = CATEGORY_GROUPS.flatMap(g => g.subcategories.map(s => s.key));
export const ALL_CATEGORY_KEYS = CATEGORY_GROUPS.map(g => g.key);

export const METRICS = CATEGORY_GROUPS.map(g => ({
  key: g.key, label: g.label, color: g.color, weight: g.effWeight,
}));

export const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];
export const POS_COLORS = {
  PG: { bg: '#E6F1FB', text: '#185FA5' },
  SG: { bg: '#EEEDFE', text: '#534AB7' },
  SF: { bg: '#EAF3DE', text: '#3B6D11' },
  PF: { bg: '#FAEEDA', text: '#854F0B' },
  C:  { bg: '#FAECE7', text: '#993C1D' },
};

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 1 — Raw Subcategory Scores
// ─────────────────────────────────────────────────────────────────────────────
function calcSubcategoryScore(player, subcategory) {
  const hasStats = subcategory.stats?.some(s => player[s.key] != null);
  if (hasStats) {
    const totalWeight = subcategory.stats.reduce((sum, s) => sum + s.weight, 0);
    const weightedSum = subcategory.stats.reduce((sum, s) => {
      let val = player[s.key] ?? 50;
      // Raw inverted stats are stored as "low = good" directional values.
      // Flip them so the score correctly reflects defensive quality.
      if (RAW_INVERTED_STATS.has(s.key)) val = 100 - val;
      return sum + val * s.weight;
    }, 0);
    return Math.max(1, Math.min(99, Math.round(weightedSum / totalWeight)));
  }
  return Math.max(1, Math.min(99, player[subcategory.key] ?? 50));
}

export function calcRawSubcategoryScores(player) {
  const scores = {};
  for (const group of CATEGORY_GROUPS) {
    for (const sub of group.subcategories) {
      scores[sub.key] = calcSubcategoryScore(player, sub);
    }
  }
  return scores;
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 2 — Position Tier Z-Score Normalization
// ─────────────────────────────────────────────────────────────────────────────
const BASELINE = 65;
const SCALE    = 16;
const MIN_STD  = 8;

export function normalizeByPositionTier(players) {
  const tiers = [1, 2, 3];
  const tierStats = {};

  for (const tier of tiers) {
    const tierPlayers = players.filter(p => getPositionTier(p) === tier);
    if (tierPlayers.length < 2) continue;
    tierStats[tier] = {};
    for (const key of ALL_SUBCATEGORY_KEYS) {
      const vals = tierPlayers.map(p => p[key] ?? 50);
      const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
      const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
      const std = Math.max(MIN_STD, Math.sqrt(variance));
      tierStats[tier][key] = { mean, std };
    }
  }

  return players.map(p => {
    const tier = getPositionTier(p);
    const stats = tierStats[tier];
    if (!stats) return { ...p };
    const normalized = { ...p };
    for (const key of ALL_SUBCATEGORY_KEYS) {
      const { mean, std } = stats[key] || { mean: 50, std: MIN_STD };
      const z = ((p[key] ?? 50) - mean) / std;
      normalized[key] = Math.round(Math.min(99, Math.max(1, BASELINE + z * SCALE)));
    }
    return normalized;
  });
}

export const normalizeByPosition = normalizeByPositionTier;

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 2.5 — Net Impact Anchor
// ─────────────────────────────────────────────────────────────────────────────
//
// netRtg: raw on/off net rating differential (e.g. +8.5 for Jokic, -3 for bench warmers)
//   → converted to a 1–99 anchor: netRtg=0 → 50, +10 → 80, -10 → 20
// netRtgAdjustment: legacy override (1–99 scale), takes precedence if set
//
// The anchor is blended at 10% weight into each normalized subcategory score.
// Effect: +10 net rating nudges every subcategory ~3 points upward.
//         A player with no netRtg data is unaffected (anchor is skipped).
export function netRtgToAnchor(netRtg) {
  return Math.round(Math.min(99, Math.max(1, 50 + netRtg * 3)));
}

export function applyNetImpactAnchor(normalizedScore, anchor) {
  if (anchor == null) return normalizedScore;
  const anchored = normalizedScore * 0.90 + anchor * 0.10;
  return Math.round(Math.min(99, Math.max(1, anchored)));
}

export function applyNetImpactAnchors(player) {
  // Prefer explicit netRtgAdjustment override; fall back to computed netRtg anchor
  let anchor = null;
  if (player.netRtgAdjustment != null) {
    anchor = player.netRtgAdjustment;
  } else if (player.netRtg != null) {
    anchor = netRtgToAnchor(player.netRtg);
  }
  if (anchor == null) return { ...player };
  const anchored = { ...player };
  for (const key of ALL_SUBCATEGORY_KEYS) {
    anchored[key] = applyNetImpactAnchor(player[key] ?? 50, anchor);
  }
  return anchored;
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 2.75 — Height Modifier (Interior Defense only)
// ─────────────────────────────────────────────────────────────────────────────
//
// After tier normalization, a guard with great (for a guard) interior D stats
// can score as high as an elite big, because they're compared within-tier.
// This layer corrects that by anchoring interior D to physical size.
//
// Formula: bonus = clamp((heightInches - 79) * 1.6, -14, 14)
//   • 6'7" (79 in) → neutral (±0)
//   • 7'0" (84 in) → +8
//   • 7'4" (88 in) → +14  (Wembanyama, Edey)
//   • 6'4" (76 in) → -5   (guards get a mild nerf)
//   • 6'0" (72 in) → -11  (short guards heavily penalized)
//
// Applied only to: rimProtection, paintDeterrence, interiorPositioning
// Players with no heightInches data are unaffected.
const INTERIOR_DEF_SUBCATS = new Set(['rimProtection', 'paintDeterrence', 'interiorPositioning']);

export function applyHeightModifier(player) {
  const height = player.heightInches;
  if (height == null) return { ...player };
  const bonus = Math.round(Math.min(14, Math.max(-14, (height - 79) * 1.6)));
  if (bonus === 0) return { ...player };
  const adjusted = { ...player };
  for (const key of INTERIOR_DEF_SUBCATS) {
    adjusted[key] = Math.min(99, Math.max(1, (adjusted[key] ?? 50) + bonus));
  }
  return adjusted;
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 3 — Subcategory → Category Weighted Averages
// ─────────────────────────────────────────────────────────────────────────────
export function deriveParentScores(player) {
  const derived = { ...player };
  for (const group of CATEGORY_GROUPS) {
    const totalWeight = group.subcategories.reduce((s, sub) => s + (sub.weight || 1), 0);
    const weightedSum = group.subcategories.reduce((s, sub) =>
      s + (player[sub.key] ?? 50) * (sub.weight || 1), 0);
    derived[group.key] = Math.round(weightedSum / totalWeight);
  }
  return derived;
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 4 — EFF Score (direct subcategory weighted composite)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Layer 4a: Compute raw EFF directly from subcategory scores.
 *
 * Uses player-adaptive weighting: each subcategory's base effSubWeight is
 * scaled by a factor derived from the player's own score in that subcategory.
 * High scores boost that category's weight; low scores reduce it.
 *
 *   adaptiveFactor(score) = 1.0 + ALPHA * tanh((score - 50) / 25)
 *   ALPHA = 0.35 → max ±33% adjustment at the extremes (score=0 or 100)
 *
 * After scaling, weights are renormalized to sum to 1.0 so absolute values
 * stay comparable across players. Net effect: a player's best skills weigh
 * proportionally more in their EFF, rewarding specialists without inflating
 * or penalizing players just for their position.
 *
 * USG% modifier (optional):
 *   When usgPct is available, applies a volume multiplier:
 *   avg 20% USG → factor ~1.0; star 35% USG → factor ~1.06.
 */
export function calcRawEFF(player) {
  const ALPHA = 0.35;

  // Build adaptive weights and compute total for renormalization
  let totalWeight = 0;
  const entries = [];
  for (const group of CATEGORY_GROUPS) {
    for (const sub of group.subcategories) {
      const score = player[sub.key] ?? 50;
      const adaptiveFactor = 1.0 + ALPHA * Math.tanh((score - 50) / 25);
      const w = sub.effSubWeight * adaptiveFactor;
      entries.push({ key: sub.key, weight: w });
      totalWeight += w;
    }
  }

  // Weighted sum with renormalized weights (always sums to 1.0 per player)
  let sum = 0;
  for (const { key, weight } of entries) {
    sum += (player[key] ?? 50) * (weight / totalWeight);
  }

  // USG% modifier: adjusts for player usage/volume
  //   usg=10 (role player) → factor ~0.96
  //   usg=20 (league avg)  → factor  1.00  ← default / neutral
  //   usg=35 (star)        → factor ~1.06
  // Defaults to 20 when usgPct is unavailable, so existing data is unaffected.
  const usg = player.usgPct ?? 20;
  const usgFactor = 1.0 + (Math.min(usg, 40) - 20) * 0.004;
  return sum * usgFactor;
}

/**
 * Layer 4b: Linearly rescale raw EFF to 62–98 display range.
 * DISPLAY ONLY — never feed this back into any calculation.
 */
export function rescaleEFF(rawEFF, minRaw, maxRaw) {
  if (maxRaw === minRaw) return 80;
  return Math.round(62 + (rawEFF - minRaw) / (maxRaw - minRaw) * 36);
}

export function calcEffectiveness(player) {
  return calcRawEFF(player);
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 5 — Chemistry Boosts
// ─────────────────────────────────────────────────────────────────────────────
export function applyChemistryBoosts(subcategoryScores, boosts = {}) {
  const boosted = { ...subcategoryScores };
  for (const [key, delta] of Object.entries(boosts)) {
    if (boosted[key] != null) {
      boosted[key] = Math.min(99, Math.max(1, boosted[key] + delta));
    }
  }
  return boosted;
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 6 — Simulation Weights
// ─────────────────────────────────────────────────────────────────────────────
export function calcSimulationWeights(player, isBench = false) {
  const offensive =
    (player.playmaking  ?? 50) * 0.32 +
    (player.shooting    ?? 50) * 0.38 +
    (player.finishing   ?? 50) * 0.30;

  const defensive =
    (player.interiorDef ?? 50) * 0.55 +
    (player.perimDef    ?? 50) * 0.45;

  const mult = isBench ? 0.35 : 1.0;
  return { offensive: offensive * mult, defensive: defensive * mult };
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTRY POINT — calculatePlayerEFF
// ─────────────────────────────────────────────────────────────────────────────
export function calculatePlayerEFF(player, allPlayers, chemistryBoosts = {}, isBench = false) {
  const rawSubcategoryScores = calcRawSubcategoryScores(player);

  const pool = allPlayers.map(p => ({
    ...p,
    ...calcRawSubcategoryScores(p),
  }));
  const normalizedPool = normalizeByPositionTier(pool);
  const normalizedPlayer = normalizedPool.find(p => p.id === player.id)
    ?? { ...player, ...rawSubcategoryScores };

  const anchoredPlayer  = applyNetImpactAnchors(normalizedPlayer);
  const heightAdjPlayer = applyHeightModifier({ ...anchoredPlayer, heightInches: player.heightInches });
  const normalizedSubcategoryScores = Object.fromEntries(
    ALL_SUBCATEGORY_KEYS.map(k => [k, heightAdjPlayer[k] ?? 50])
  );

  const boostedScores = applyChemistryBoosts(normalizedSubcategoryScores, chemistryBoosts);
  const playerWithBoosts = { ...heightAdjPlayer, ...boostedScores };

  const withCategories = deriveParentScores(playerWithBoosts);
  const categoryScores = Object.fromEntries(
    ALL_CATEGORY_KEYS.map(k => [k, withCategories[k]])
  );

  const rawEFF = calcRawEFF(withCategories);
  const allRawEffs = normalizedPool.map(p => calcRawEFF(deriveParentScores(p)));
  const minRaw = Math.min(...allRawEffs);
  const maxRaw = Math.max(...allRawEffs);
  const displayEFF = rescaleEFF(rawEFF, minRaw, maxRaw);

  const simulationWeights = calcSimulationWeights(withCategories, isBench);

  return {
    rawSubcategoryScores,
    normalizedSubcategoryScores,
    categoryScores,
    rawEFF,
    displayEFF,
    simulationWeights,
  };
}

// ─── Sort Options ──────────────────────────────────────────────────────────────
export const SORT_OPTIONS = [
  { value: 'eff',                 label: 'Effectiveness' },
  { value: 'playmaking',          label: 'Playmaking' },
  { value: 'decisionQuality',     label: 'Decision Quality' },
  { value: 'ballMovement',        label: 'Ball Movement' },
  { value: 'courtVision',         label: 'Court Vision' },
  { value: 'shooting',            label: 'Shooting' },
  { value: 'shotQuality',         label: 'Shot Quality' },
  { value: 'shotCreation',        label: 'Shot Creation' },
  { value: 'shootingGravity',     label: 'Gravity / Spacing' },
  { value: 'finishing',           label: 'Finishing' },
  { value: 'paintEfficiency',     label: 'Paint Efficiency' },
  { value: 'driveImpact',         label: 'Drive Impact' },
  { value: 'transitionScoring',   label: 'Transition Scoring' },
  { value: 'rebounding',          label: 'Rebounding' },
  { value: 'defRebounding',       label: 'Def. Rebounding' },
  { value: 'offRebounding',       label: 'Off. Rebounding' },
  { value: 'reboundPositioning',  label: 'Reb. Positioning' },
  { value: 'interiorDef',         label: 'Interior D' },
  { value: 'rimProtection',       label: 'Rim Protection' },
  { value: 'paintDeterrence',     label: 'Paint Deterrence' },
  { value: 'interiorPositioning', label: 'Interior Positioning' },
  { value: 'perimDef',            label: 'Perimeter D' },
  { value: 'onBallPressure',      label: 'On-Ball Pressure' },
  { value: 'offBallAwareness',    label: 'Off-Ball Awareness' },
  { value: 'schemeVersatility',   label: 'Scheme Versatility' },
];
