/**
 * Pre-computed normalized + enriched player data.
 *
 * Pipeline (runs once at module load):
 *   Layer 1  — calcRawSubcategoryScores: merge raw subcategory scores into each player
 *   Layer 2  — normalizeByPositionTier: z-score normalize within 3 position tiers
 *              (Tier 1: Guards, Tier 2: Wings, Tier 3: Bigs)
 *              BASELINE=65, SCALE=16, MIN_STD=8 → all 18 categories on the same visual scale
 *   Layer 2.5 — applyNetImpactAnchors: blend with on-court net rating adjustment
 *              (anchored = normalized × 0.85 + netRtgAdjustment × 0.15)
 *              Currently null for all players; populated by nba_data_pipeline.py
 *   Layer 3  — deriveParentScores: weighted subcategory → category averages
 *   Layer 4  — calcRawEFF + rescaleEFF: effectiveness score, linearly mapped to 62–98
 *              DISPLAY ONLY — simulation uses raw category scores, not EFF
 *
 * Chemistry boosts (Layer 5) and simulation weights (Layer 6) are computed
 * on-demand in components, not pre-computed here.
 */
import { PLAYERS } from './players';
import {
  calcRawSubcategoryScores,
  normalizeByPositionTier,
  applyNetImpactAnchors,
  deriveParentScores,
  calcRawEFF,
  rescaleEFF,
} from '../utils/metrics';

// ── Layer 1: Merge raw subcategory scores into each player ────────────────────
// calcRawSubcategoryScores uses component stats if present (real API data),
// or falls back to the direct subcategory value on the player object.
const withRawScores = PLAYERS.map(p => ({
  ...p,
  ...calcRawSubcategoryScores(p),
}));

// ── Layer 2: Z-score normalize by position tier ───────────────────────────────
// Uses 3 functional tiers instead of 5 positions for more stable estimates
// and better cross-position comparability.
const normalized = normalizeByPositionTier(withRawScores);

// ── Layer 2.5: Net impact anchor ──────────────────────────────────────────────
// Blends normalized scores with on-court net rating adjustment.
// Currently a no-op (all players have netRtgAdjustment: null).
// Will activate automatically once nba_data_pipeline.py populates the field.
const anchored = normalized.map(p => applyNetImpactAnchors(p));

// ── Layer 3: Derive parent category scores ────────────────────────────────────
const withParents = anchored.map(p => deriveParentScores(p));

// ── Layer 4: EFF score + display rescaling ────────────────────────────────────
// Compute raw EFF for every player, then linearly rescale to 62–98.
// The simulation uses category scores (playmaking, shooting, …), never EFF.
const rawEffs = withParents.map(p => calcRawEFF(p));
const minRaw = Math.min(...rawEffs);
const maxRaw = Math.max(...rawEffs);

const EFF_MIN = 62;
const EFF_MAX = 98;

export const ALL_PLAYERS = withParents.map((p, i) => {
  const displayEff = maxRaw === minRaw
    ? 80
    : Math.round(EFF_MIN + (rawEffs[i] - minRaw) / (maxRaw - minRaw) * (EFF_MAX - EFF_MIN));
  return { ...p, eff: displayEff };
});

export function getPlayerById(id) {
  return ALL_PLAYERS.find(p => p.id === id) || null;
}
