import React, { useState } from 'react';
import { applyChemistry } from '../utils/chemistry';
import { calcEffectiveness, lastName } from '../utils/metrics';

function inFt(inches) {
  if (!inches) return '';
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

// ── Out-of-Position penalty (tier-based) ────────────────────────────────────
// Tier 1 (PG/SG ball-handlers): free at PG, SG
// Tier 2 (wings/forwards):      free at SG, SF, PF
// Tier 3 (bigs):                free at PF, C
const TIER_FREE_SLOTS = {
  1: new Set(['PG', 'SG']),
  2: new Set(['SG', 'SF', 'PF']),
  3: new Set(['PF', 'C']),
};
const SLOT_IDX = { PG: 0, SG: 1, SF: 2, PF: 3, C: 4 };
const TIER_CENTER = { 1: 0.5, 2: 2.0, 3: 3.5 };

function calcPosPenalty(slotKey, player) {
  const tier = player.tier ?? (player.pos === 'PG' || player.pos === 'SG' ? 1 : player.pos === 'C' ? 3 : 2);
  const free = TIER_FREE_SLOTS[tier] ?? new Set(['PG', 'SG', 'SF', 'PF', 'C']);
  if (free.has(slotKey)) return 0;
  const dist = Math.abs(SLOT_IDX[slotKey] - TIER_CENTER[tier]);
  return Math.min(18, Math.round(dist * 5));
}

// ── 18 court lines — clockwise from 12 o'clock, matching key left-to-right ────
// Playmaking (3) → Shooting (3) → Finishing (3) → Rebounding (3) → Interior Def (3) → Perimeter Def (3)
export const COURT_LINES = [
  { key: 'decisionQuality',     color: '#3266ad', label: 'Decision Quality' },
  { key: 'ballMovement',        color: '#3266ad', label: 'Ball Movement' },
  { key: 'courtVision',         color: '#3266ad', label: 'Court Vision' },
  { key: 'shotQuality',         color: '#E24B4A', label: 'Shot Quality' },
  { key: 'shotCreation',        color: '#E24B4A', label: 'Shot Creation' },
  { key: 'shootingGravity',     color: '#E24B4A', label: 'Shooting Gravity' },
  { key: 'paintEfficiency',     color: '#BA7517', label: 'Paint Efficiency' },
  { key: 'driveImpact',         color: '#BA7517', label: 'Drive Impact' },
  { key: 'transitionScoring',   color: '#BA7517', label: 'Transition Scoring' },
  { key: 'offRebounding',       color: '#1D9E75', label: 'Off. Rebounding' },
  { key: 'defRebounding',       color: '#1D9E75', label: 'Def. Rebounding' },
  { key: 'reboundPositioning',  color: '#1D9E75', label: 'Rebd. Positioning' },
  { key: 'rimProtection',       color: '#D85A30', label: 'Rim Protection' },
  { key: 'paintDeterrence',     color: '#D85A30', label: 'Paint Deterrence' },
  { key: 'interiorPositioning', color: '#D85A30', label: 'Interior Position' },
  { key: 'onBallPressure',      color: '#7F77DD', label: 'On-Ball Pressure' },
  { key: 'offBallAwareness',    color: '#7F77DD', label: 'Off-Ball Awareness' },
  { key: 'schemeVersatility',   color: '#7F77DD', label: 'Scheme Versatility' },
];

export const SLOT_DEFS = [
  { key: 'PG', label: 'Point Guard',    cx: 400, cy: 462, color: '#3b82f6' },
  { key: 'SG', label: 'Shooting Guard', cx: 150, cy: 354, color: '#a78bfa' },
  { key: 'SF', label: 'Small Forward',  cx: 650, cy: 354, color: '#34d399' },
  { key: 'PF', label: 'Power Forward',  cx: 215, cy: 188, color: '#fbbf24' },
  { key: 'C',  label: 'Center',         cx: 585, cy: 188, color: '#fb923c' },
];

// Compute bar length with a power curve for strong visual differentiation.
// A player at 99 gets ~60px, avg (65) gets ~28px, low (30) gets ~8px.
function barLength(val) {
  const t = Math.max(0, Math.min(val, 99)) / 99;
  return 4 + Math.pow(t, 1.5) * 58;
}

function PlayerSlotNode({ slotDef, player, boostedPlayer, posPenalty, chemDelta, subDeltas, onClick, overrideColor, onHoverStat }) {
  const { cx, cy, key, label } = slotDef;
  const color = overrideColor ?? slotDef.color;
  const hasPlayer = !!player;
  const r = 44;
  const inner = r + 6;
  const displayPlayer = boostedPlayer || player;
  const displayEff = boostedPlayer
    ? Math.max(0, boostedPlayer.eff - posPenalty)
    : null;

  // Average-level reference ring radius
  const avgRingR = inner + barLength(50);

  // Chemistry ring styling
  const hasChemistry = hasPlayer && chemDelta !== 0;
  const chemColor  = chemDelta > 0 ? '#4ade80' : '#f87171';
  const chemRingW  = Math.max(1, Math.min(3, Math.abs(chemDelta) * 0.35));
  const chemRingO  = Math.min(0.8, 0.2 + Math.abs(chemDelta) * 0.1);

  return (
    <g style={{ cursor: 'pointer' }} onClick={onClick}>
      {/* 18 subcategory spokes */}
      {COURT_LINES.map((line, i) => {
        const angleDeg = -90 + i * 20;
        const angleRad = (angleDeg * Math.PI) / 180;

        if (hasPlayer && displayPlayer) {
          const val = displayPlayer[line.key] ?? 0;
          const lineLen = barLength(val);
          const sd = subDeltas?.[line.key] ?? 0;
          const x1 = cx + Math.cos(angleRad) * inner;
          const y1 = cy + Math.sin(angleRad) * inner;
          const x2 = cx + Math.cos(angleRad) * (inner + lineLen);
          const y2 = cy + Math.sin(angleRad) * (inner + lineLen);
          return (
            <g key={i}>
              {/* Glow halo for chemistry-affected spokes */}
              {sd !== 0 && (
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={sd > 0 ? line.color : '#f87171'}
                  strokeWidth={Math.min(6, 2.5 + Math.abs(sd) * 0.4)}
                  strokeOpacity={Math.min(0.55, 0.2 + Math.abs(sd) * 0.06)}
                  strokeLinecap="round"
                />
              )}
              {/* Normal spoke */}
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={line.color}
                strokeWidth={0.9}
                strokeOpacity={0.9}
                strokeLinecap="round"
              />
            </g>
          );
        } else {
          return (
            <line
              key={i}
              x1={cx + Math.cos(angleRad) * inner}
              y1={cy + Math.sin(angleRad) * inner}
              x2={cx + Math.cos(angleRad) * (inner + 10)}
              y2={cy + Math.sin(angleRad) * (inner + 10)}
              stroke={color}
              strokeWidth={0.8}
              strokeOpacity={0.25}
              strokeLinecap="round"
            />
          );
        }
      })}

      {/* Radar — category-colored wedge triangles + avg reference ring */}
      {hasPlayer && displayPlayer && (
        <>
          {/* Avg-level reference ring */}
          <circle cx={cx} cy={cy} r={avgRingR} fill="none" stroke="#ffffff" strokeWidth={0.5} strokeOpacity={0.08} strokeDasharray="3,6" />
          {/* 18 wedges, each the color of its spoke category */}
          {COURT_LINES.map((line, i) => {
            const nextI = (i + 1) % COURT_LINES.length;
            const aI = ((-90 + i * 20)        * Math.PI) / 180;
            const aN = ((-90 + nextI * 20)     * Math.PI) / 180;
            const lI = barLength(displayPlayer[line.key] ?? 0);
            const lN = barLength(displayPlayer[COURT_LINES[nextI].key] ?? 0);
            const o0x = cx + Math.cos(aI) * (inner + lI);
            const o0y = cy + Math.sin(aI) * (inner + lI);
            const o1x = cx + Math.cos(aN) * (inner + lN);
            const o1y = cy + Math.sin(aN) * (inner + lN);
            const sd = subDeltas?.[line.key] ?? 0;
            const baseFill = 0.13;
            const fillOp = sd > 0
              ? Math.min(0.45, baseFill + sd * 0.05)
              : sd < 0
                ? Math.max(0.04, baseFill + sd * 0.02)
                : baseFill;
            return (
              <polygon
                key={`w${i}`}
                points={`${cx},${cy} ${o0x},${o0y} ${o1x},${o1y}`}
                fill={sd < 0 ? '#f87171' : line.color}
                fillOpacity={fillOp}
                stroke="none"
                onMouseEnter={(e) => onHoverStat?.({ label: line.label, val: displayPlayer[line.key] ?? 0, color: line.color, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => onHoverStat?.(null)}
              />
            );
          })}
          {/* Perimeter outline — outer edge of each wedge, colored by category */}
          {COURT_LINES.map((line, i) => {
            const nextI = (i + 1) % COURT_LINES.length;
            const aI = ((-90 + i * 20)        * Math.PI) / 180;
            const aN = ((-90 + nextI * 20)     * Math.PI) / 180;
            const lI = barLength(displayPlayer[line.key] ?? 0);
            const lN = barLength(displayPlayer[COURT_LINES[nextI].key] ?? 0);
            const o0x = cx + Math.cos(aI) * (inner + lI);
            const o0y = cy + Math.sin(aI) * (inner + lI);
            const o1x = cx + Math.cos(aN) * (inner + lN);
            const o1y = cy + Math.sin(aN) * (inner + lN);
            return (
              <line
                key={`p${i}`}
                x1={o0x} y1={o0y} x2={o1x} y2={o1y}
                stroke={line.color}
                strokeWidth={0.9}
                strokeOpacity={0.65}
                strokeLinecap="round"
              />
            );
          })}
        </>
      )}

      {/* Chemistry glow ring — green for positive, red for negative net effect */}
      {hasChemistry && (
        <circle cx={cx} cy={cy} r={r + 11} fill="none" stroke={chemColor} strokeWidth={chemRingW} strokeOpacity={chemRingO} />
      )}
      {/* Outer glow ring */}
      <circle cx={cx} cy={cy} r={r + 5} fill="none" stroke={color} strokeWidth={1} strokeOpacity={hasPlayer ? 0.4 : 0.15} />
      {/* Main disc */}
      <circle cx={cx} cy={cy} r={r} fill={hasPlayer ? '#1c1c1c' : '#131313'} stroke={color} strokeWidth={hasPlayer ? 2 : 1.5} strokeOpacity={hasPlayer ? 1 : 0.3} />

      {hasPlayer ? (
        <>
          {/* First name */}
          <text x={cx} y={cy - 20} textAnchor="middle" fill={color} fontSize="9" fontWeight="400" fontFamily="system-ui">
            {player.name.split(' ')[0]}
          </text>
          {/* Last name */}
          <text x={cx} y={cy - 8} textAnchor="middle" fill="white" fontSize="12" fontWeight="700" fontFamily="system-ui">
            {lastName(player.name).toUpperCase()}
          </text>
          {/* Position · height — team color, between last name and score */}
          <text x={cx} y={cy + 4} textAnchor="middle" fill={color} fontSize="8" fontWeight="600" fontFamily="system-ui" fillOpacity="0.85">
            {player.pos}{player.heightInches ? ` · ${inFt(player.heightInches)}` : ''}
          </text>
          {/* Effectiveness score */}
          <text x={cx} y={cy + 17} textAnchor="middle" fill={posPenalty > 0 ? '#ff6b6b' : 'white'} fontSize="14" fontWeight="700" fontFamily="system-ui">
            {displayEff}
          </text>
          {posPenalty > 0 && (
            <text x={cx} y={cy + 28} textAnchor="middle" fill="#ff6b6b" fontSize="8" fontWeight="500" fontFamily="system-ui" fillOpacity="0.8">
              -{posPenalty} OOP
            </text>
          )}
          {/* Chemistry delta badge — pill just below the disc */}
          {hasChemistry && (
            <>
              <rect x={cx - 10} y={cy + r + 5} width={20} height={11} rx={3}
                fill={chemDelta > 0 ? '#0d2a1a' : '#2a0d0d'}
                fillOpacity={0.95}
              />
              <text x={cx} y={cy + r + 13} textAnchor="middle"
                fill={chemColor} fontSize="7" fontWeight="800" fontFamily="system-ui">
                {chemDelta > 0 ? `+${chemDelta}` : chemDelta}
              </text>
            </>
          )}
        </>
      ) : (
        <>
          <text x={cx} y={cy + 2} textAnchor="middle" fill={color} fontSize="18" fontWeight="300" fontFamily="system-ui" fillOpacity="0.4">+</text>
          <text x={cx} y={cy + 16} textAnchor="middle" fill={color} fontSize="10" fontWeight="600" fontFamily="system-ui" fillOpacity="0.4">{key}</text>
        </>
      )}
    </g>
  );
}

export default function Court({ lineup, onSlotClick, color }) {
  const [tooltip, setTooltip] = useState(null);
  // color: if provided, all player slot circles use this single color (team color mode).
  //        if omitted, each slot uses its own position-based color from SLOT_DEFS.
  return (
    <>
    <svg viewBox="0 0 800 560" style={{ width: '100%', display: 'block' }} xmlns="http://www.w3.org/2000/svg">
      <rect width="800" height="612" fill="#0f0f0f" />

      {/* Court boundary */}
      <rect x="28" y="22" width="744" height="562" rx="6" fill="none" stroke="#1f3a1f" strokeWidth="2.5" />

      {/* Paint / Key */}
      <rect x="281" y="22" width="238" height="227" fill="#141a14" stroke="#1f3a1f" strokeWidth="2" />

      {/* Free throw line */}
      <line x1="281" y1="248" x2="519" y2="248" stroke="#1f3a1f" strokeWidth="2" />

      {/* Free throw circle */}
      <path d="M 311 248 A 89 72 0 0 1 489 248" fill="none" stroke="#1f3a1f" strokeWidth="1.5" strokeDasharray="6,4" />
      <path d="M 311 248 A 89 72 0 0 0 489 248" fill="none" stroke="#1f3a1f" strokeWidth="1.5" />

      {/* Backboard */}
      <rect x="356" y="62" width="88" height="6" rx="2" fill="#192019" stroke="#1f3a1f" strokeWidth="1.5" />

      {/* Basket rim */}
      <circle cx="400" cy="84" r="12" fill="none" stroke="#2a502a" strokeWidth="2" />
      <circle cx="400" cy="84" r="4"  fill="none" stroke="#2a502a" strokeWidth="1.5" />

      {/* Restricted-area arc */}
      <path d="M 340 84 A 60 48 0 0 0 460 84" fill="none" stroke="#1f3a1f" strokeWidth="1.5" />

      {/* 3-point corner lines */}
      <line x1="73"  y1="22"  x2="73"  y2="188" stroke="#1f3a1f" strokeWidth="2" />
      <line x1="727" y1="22"  x2="727" y2="188" stroke="#1f3a1f" strokeWidth="2" />

      {/* 3-point arc */}
      <path d="M 73 188 A 353 284 0 0 0 727 188" fill="none" stroke="#1f3a1f" strokeWidth="2" />

      {/* Lane tick marks */}
      {[84, 131, 179].map(absY => (
        <g key={absY}>
          <line x1="281" y1={absY} x2="261" y2={absY} stroke="#1f3a1f" strokeWidth="1.5" />
          <line x1="519" y1={absY} x2="539" y2={absY} stroke="#1f3a1f" strokeWidth="1.5" />
        </g>
      ))}

      {/* Elbow marks */}
      <line x1="281" y1="248" x2="261" y2="248" stroke="#1f3a1f" strokeWidth="1.5" />
      <line x1="519" y1="248" x2="539" y2="248" stroke="#1f3a1f" strokeWidth="1.5" />

      {/* Player slots */}
      {SLOT_DEFS.map(slot => {
        const player = lineup[slot.key] || null;
        const teammates = SLOT_DEFS
          .filter(s => s.key !== slot.key && lineup[s.key])
          .map(s => lineup[s.key]);
        let boostedPlayer = null;
        let posPenalty = 0;
        let chemDelta = 0;
        let subDeltas = {};
        if (player) {
          const b = applyChemistry(player, teammates);
          const rawBase    = calcEffectiveness(player);
          const rawBoosted = calcEffectiveness(b);
          chemDelta  = Math.round(rawBoosted - rawBase);
          boostedPlayer = { ...b, eff: Math.round(Math.min(99, player.eff + chemDelta)) };
          posPenalty = calcPosPenalty(slot.key, player);
          // Per-subcategory deltas for spoke glow
          for (const line of COURT_LINES) {
            const d = (b[line.key] ?? 0) - (player[line.key] ?? 0);
            if (d !== 0) subDeltas[line.key] = d;
          }
        }
        return (
          <PlayerSlotNode
            key={slot.key}
            slotDef={slot}
            player={player}
            boostedPlayer={boostedPlayer}
            posPenalty={posPenalty}
            chemDelta={chemDelta}
            subDeltas={subDeltas}
            onClick={() => onSlotClick(slot.key)}
            overrideColor={color}
            onHoverStat={setTooltip}
          />
        );
      })}
    </svg>
    {tooltip && (
      <div style={{
        position: 'fixed',
        left: tooltip.x + 14,
        top: tooltip.y - 48,
        background: '#111',
        border: `1px solid ${tooltip.color}88`,
        borderRadius: 6,
        padding: '5px 11px',
        pointerEvents: 'none',
        zIndex: 9999,
        fontFamily: 'system-ui, sans-serif',
        minWidth: 90,
      }}>
        <div style={{ fontSize: 9, color: tooltip.color, fontWeight: 700, marginBottom: 2, letterSpacing: '0.04em' }}>{tooltip.label}</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'white', lineHeight: 1 }}>{tooltip.val}</div>
      </div>
    )}
    </>
  );
}
