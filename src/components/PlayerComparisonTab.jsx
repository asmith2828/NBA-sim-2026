import React, { useState, useMemo } from 'react';
import { ALL_PLAYERS } from '../data/normalizedPlayers';
import { CATEGORY_GROUPS, ALL_SUBCATEGORY_KEYS, POSITIONS, POS_COLORS, SORT_OPTIONS, lastName } from '../utils/metrics';
import { COURT_LINES } from './Court';

// ── Similarity algorithm ─────────────────────────────────────────────────────
const TIER_PENALTY = 120;

function findSimilarPlayers(target, allPlayers, n = 10) {
  const targetTier = target.tier ?? 2;
  const distances = allPlayers
    .filter(p => p.id !== target.id)
    .map(p => {
      let distSq = 0;
      for (const key of ALL_SUBCATEGORY_KEYS) {
        const diff = (target[key] ?? 50) - (p[key] ?? 50);
        distSq += diff * diff;
      }
      const tierDiff = Math.abs((p.tier ?? 2) - targetTier);
      const dist = Math.sqrt(distSq) + tierDiff * TIER_PENALTY;
      return { player: p, dist };
    })
    .sort((a, b) => a.dist - b.dist)
    .slice(0, n);

  const maxDist = distances[distances.length - 1]?.dist ?? 1;
  const minDist = distances[0]?.dist ?? 0;
  return distances.map(d => ({
    ...d,
    similarity: Math.round(100 - ((d.dist - minDist) / (maxDist - minDist + 1)) * 35),
  }));
}

// ── Bar length helper ─────────────────────────────────────────────────────────
function barLen(val, maxLen) {
  const t = Math.max(0, Math.min(val, 99)) / 99;
  return 4 + Math.pow(t, 1.5) * maxLen;
}

// ── Draw 18 radial spokes + category-colored radar wedges ────────────────────
function CircleBars({ cx, cy, r, player, strokeWidth }) {
  const barMax   = r * 0.90;
  const inner    = r + 6;
  const avgRingR = inner + barLen(50, barMax);

  return (
    <>
      {/* Spokes */}
      {COURT_LINES.map((line, i) => {
        const angleRad = ((-90 + i * 20) * Math.PI) / 180;
        const len = barLen(player[line.key] ?? 0, barMax);
        return (
          <line
            key={i}
            x1={cx + Math.cos(angleRad) * inner}
            y1={cy + Math.sin(angleRad) * inner}
            x2={cx + Math.cos(angleRad) * (inner + len)}
            y2={cy + Math.sin(angleRad) * (inner + len)}
            stroke={line.color}
            strokeWidth={strokeWidth ?? 0.8}
            strokeOpacity={0.88}
            strokeLinecap="round"
          />
        );
      })}
      {/* Avg reference ring */}
      <circle cx={cx} cy={cy} r={avgRingR} fill="none" stroke="#ffffff" strokeWidth={0.5} strokeOpacity={0.07} strokeDasharray="3,6" />
      {/* Category-colored wedge triangles (disc rendered on top masks center) */}
      {COURT_LINES.map((line, i) => {
        const nextI = (i + 1) % COURT_LINES.length;
        const aI    = ((-90 + i * 20)     * Math.PI) / 180;
        const aN    = ((-90 + nextI * 20) * Math.PI) / 180;
        const lI    = barLen(player[line.key] ?? 0, barMax);
        const lN    = barLen(player[COURT_LINES[nextI].key] ?? 0, barMax);
        const o0x   = cx + Math.cos(aI) * (inner + lI);
        const o0y   = cy + Math.sin(aI) * (inner + lI);
        const o1x   = cx + Math.cos(aN) * (inner + lN);
        const o1y   = cy + Math.sin(aN) * (inner + lN);
        return (
          <polygon
            key={`w${i}`}
            points={`${cx},${cy} ${o0x},${o0y} ${o1x},${o1y}`}
            fill={line.color}
            fillOpacity={0.12}
            stroke="none"
          />
        );
      })}
      {/* Perimeter outline — outer edge of each wedge, colored by category */}
      {COURT_LINES.map((line, i) => {
        const nextI = (i + 1) % COURT_LINES.length;
        const aI    = ((-90 + i * 20)     * Math.PI) / 180;
        const aN    = ((-90 + nextI * 20) * Math.PI) / 180;
        const lI    = barLen(player[line.key] ?? 0, barMax);
        const lN    = barLen(player[COURT_LINES[nextI].key] ?? 0, barMax);
        const o0x   = cx + Math.cos(aI) * (inner + lI);
        const o0y   = cy + Math.sin(aI) * (inner + lI);
        const o1x   = cx + Math.cos(aN) * (inner + lN);
        const o1y   = cy + Math.sin(aN) * (inner + lN);
        return (
          <line
            key={`p${i}`}
            x1={o0x} y1={o0y} x2={o1x} y2={o1y}
            stroke={line.color}
            strokeWidth={strokeWidth ?? 0.8}
            strokeOpacity={0.65}
            strokeLinecap="round"
          />
        );
      })}
    </>
  );
}

// ── Orbital layout constants ──────────────────────────────────────────────────
const SVG_W = 960;
const SVG_H = 960;
const CX    = 480;
const CY    = 480;
const CENTER_R = 82;

// Fixed organic layout — positions hand-tuned so:
//  • larger discs (#1–3) sit in the inner ring (~210–260 px from center)
//  • mid discs (#4–6) in the middle ring (~290–330 px)
//  • small discs (#7–10) pushed to the outer edge (~360–435 px)
//  • angles are deliberately irregular so nothing looks evenly spaced
//  • all positions verified non-overlapping and within the 960×960 SVG
//
// Format: [angleDeg, distFromCenter, discRadius]
const FIXED_PLANET_SLOTS = [
  [ -45,  215, 44 ],   // #1  – upper right,  close
  [ 175,  238, 39 ],   // #2  – left,         close
  [  98,  252, 34 ],   // #3  – lower,        close
  [-132,  288, 30 ],   // #4  – upper left,   mid
  [  22,  310, 27 ],   // #5  – right,        mid
  [ 148,  328, 24 ],   // #6  – lower left,   mid
  [ -82,  368, 21 ],   // #7  – upper,        far
  [  58,  392, 18 ],   // #8  – lower right,  far
  [-158,  418, 16 ],   // #9  – far left,     far
  [ 128,  434, 14 ],   // #10 – lower left,   far
];

// Convert the fixed slots to { x, y, r } — same shape the renderer expects
function buildPlanetPositions(comparisons) {
  return comparisons.map((_, i) => {
    const [angleDeg, dist, r] = FIXED_PLANET_SLOTS[i] ?? [0, 250, 14];
    const rad = (angleDeg * Math.PI) / 180;
    return { x: CX + dist * Math.cos(rad), y: CY + dist * Math.sin(rad), r };
  });
}

const POS_CLR = {
  PG: '#3b82f6', SG: '#a78bfa', SF: '#34d399', PF: '#fbbf24', C: '#fb923c',
};

// ── Orbital display (all 10 similar players around the target) ────────────────
function OrbitalDisplay({ target, comparisons, onSelectPlayer }) {
  // Compute organic layout once per target selection
  const planetPositions = useMemo(
    () => buildPlanetPositions(comparisons),
    [comparisons.length], // eslint-disable-line
  );

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      style={{ width: '100%', maxWidth: SVG_W, display: 'block', margin: '0 auto' }}
    >
      <rect width={SVG_W} height={SVG_H} fill="#0d0d0d" rx={10} />

      {/* ── Center player ── */}
      <CircleBars cx={CX} cy={CY} r={CENTER_R} player={target} strokeWidth={1.1} />
      <circle cx={CX} cy={CY} r={CENTER_R + 5} fill="none" stroke="#fbbf24" strokeWidth={1} strokeOpacity={0.3} />
      <circle
        cx={CX} cy={CY} r={CENTER_R} fill="#1c1c1c" stroke="#fbbf24" strokeWidth={2} strokeOpacity={0.9}
        style={{ cursor: 'pointer' }}
        onClick={() => onSelectPlayer(target)}
      />
      <text x={CX} y={CY - CENTER_R - 12} textAnchor="middle" fill="#fbbf24" fontSize={8} fontWeight="700" fontFamily="system-ui" letterSpacing="0.07em">
        SELECTED PLAYER
      </text>
      <text x={CX} y={CY - 10} textAnchor="middle" fill={POS_CLR[target.pos] ?? '#aaa'} fontSize={11} fontFamily="system-ui" style={{ pointerEvents: 'none' }}>
        {target.name.split(' ')[0]}
      </text>
      <text x={CX} y={CY + 6} textAnchor="middle" fill="white" fontSize={15} fontWeight="700" fontFamily="system-ui" style={{ pointerEvents: 'none' }}>
        {lastName(target.name).toUpperCase()}
      </text>
      <text x={CX} y={CY + 22} textAnchor="middle" fill="#555" fontSize={9} fontFamily="system-ui" style={{ pointerEvents: 'none' }}>
        {target.pos} · {target.team}
      </text>

      {/* ── Orbiting planets ── */}
      {comparisons.map((c, i) => {
        const pos = planetPositions[i];
        if (!pos) return null;
        const { x: pcx, y: pcy, r } = pos;
        const p      = c.player;
        const posClr = POS_CLR[p.pos] ?? '#aaa';

        // Direction vector from center → planet (for badge placement)
        const dx   = pcx - CX, dy = pcy - CY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx   = dx / dist, ny = dy / dist;
        const badgeDist = r + 28;
        const badgeX = pcx + nx * badgeDist;
        const badgeY = pcy + ny * badgeDist;

        const firstSz = Math.max(6,  Math.round(r * 0.22));
        const lastSz  = Math.max(8,  Math.round(r * 0.30));
        const effSz   = Math.max(9,  Math.round(r * 0.36));
        const teamSz  = Math.max(6,  Math.round(r * 0.18));

        const textTop  = pcy - r * 0.32;
        const textMid  = textTop + lastSz + 2;
        const effY     = pcy + r * 0.18;
        const teamY    = pcy + r * 0.42;
        const showFull = r >= 30;

        return (
          <g key={p.id} style={{ cursor: 'pointer' }} onClick={() => onSelectPlayer(p)}>
            <CircleBars cx={pcx} cy={pcy} r={r} player={p} strokeWidth={0.7} />
            <circle cx={pcx} cy={pcy} r={r + 4} fill="none" stroke="#333" strokeWidth={0.8} strokeOpacity={0.45} />
            <circle cx={pcx} cy={pcy} r={r} fill="#1c1c1c" stroke="#444" strokeWidth={1.5} strokeOpacity={0.75} />

            {showFull ? (
              <>
                <text x={pcx} y={pcy - 5} textAnchor="middle" fill={posClr} fontSize={firstSz} fontFamily="system-ui" style={{ pointerEvents: 'none' }}>
                  {p.name.split(' ')[0]}
                </text>
                <text x={pcx} y={pcy + firstSz + 2} textAnchor="middle" fill="#ccc" fontSize={lastSz} fontWeight="700" fontFamily="system-ui" style={{ pointerEvents: 'none' }}>
                  {lastName(p.name).toUpperCase()}
                </text>
                <text x={pcx} y={pcy + firstSz + lastSz + 6} textAnchor="middle" fill="#555" fontSize={teamSz} fontFamily="system-ui" style={{ pointerEvents: 'none' }}>
                  {p.pos} · {p.team}
                </text>
              </>
            ) : (
              <text x={pcx} y={pcy + 4} textAnchor="middle" fill="#ccc" fontSize={Math.max(6, lastSz)} fontWeight="700" fontFamily="system-ui" style={{ pointerEvents: 'none' }}>
                {lastName(p.name).slice(0, 6).toUpperCase()}
              </text>
            )}

            {/* Rank + similarity badge */}
            <text x={badgeX} y={badgeY - 5} textAnchor="middle" fill="#666" fontSize={7} fontWeight="700" fontFamily="system-ui" letterSpacing="0.05em" style={{ pointerEvents: 'none' }}>
              #{i + 1} MATCH
            </text>
            <text x={badgeX} y={badgeY + 6} textAnchor="middle" fill="#444" fontSize={7} fontFamily="system-ui" style={{ pointerEvents: 'none' }}>
              {c.similarity}% similar
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Player stat overlay ───────────────────────────────────────────────────────
function PlayerOverlay({ player, target, onClose }) {
  const posClr = POS_CLR[player.pos] ?? '#aaa';
  const isTarget = target && player.id === target.id;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#111', border: '1px solid #2a2a2a', borderRadius: 14,
          width: '100%', maxWidth: 480, maxHeight: '90vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative',
        }}
      >
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #1e1e1e', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 10, color: posClr, fontWeight: 700, marginBottom: 2 }}>
                {player.name.split(' ')[0]}
              </div>
              <div style={{ fontSize: 22, color: 'white', fontWeight: 900, lineHeight: 1 }}>
                {lastName(player.name).toUpperCase()}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, background: posClr + '22', color: posClr, fontWeight: 700 }}>{player.pos}</span>
                <span style={{ fontSize: 10, color: '#555' }}>{player.team}</span>
                {isTarget && <span style={{ fontSize: 8, color: '#fbbf24', fontWeight: 700 }}>SELECTED</span>}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 36, color: 'white', fontWeight: 900, lineHeight: 1 }}>{player.eff}</div>
              <div style={{ fontSize: 8, color: '#444', fontWeight: 700 }}>OVERALL</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 12, right: 12,
              background: 'none', border: '1px solid #2a2a2a', borderRadius: 6,
              color: '#555', fontSize: 14, width: 28, height: 28, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </div>

        <div style={{ overflowY: 'auto', padding: '12px 16px 16px' }}>
          {CATEGORY_GROUPS.map(g => {
            const score = player[g.key] ?? 0;
            const targetScore = target ? (target[g.key] ?? 0) : null;
            const diff = targetScore !== null && !isTarget ? score - targetScore : null;
            return (
              <div key={g.key} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 9, color: g.color, fontWeight: 700, width: 24 }}>
                    {g.label.slice(0,2).toUpperCase()}
                  </span>
                  <span style={{ fontSize: 11, color: g.color, fontWeight: 700, flex: 1 }}>{g.label}</span>
                  {diff !== null && (
                    <span style={{ fontSize: 9, color: diff > 0 ? '#4ade80' : diff < 0 ? '#f87171' : '#555', fontWeight: 700 }}>
                      {diff > 0 ? `+${diff}` : diff}
                    </span>
                  )}
                  <span style={{ fontSize: 13, color: 'white', fontWeight: 800 }}>{score}</span>
                </div>
                <div style={{ height: 5, background: '#1a1a1a', borderRadius: 3, overflow: 'hidden', marginBottom: 5 }}>
                  <div style={{ height: '100%', width: `${Math.round(score * 0.9)}%`, background: g.color, opacity: 0.8 }} />
                </div>
                {g.subcategories.map(sub => {
                  const val = player[sub.key] ?? 0;
                  const tv = target ? (target[sub.key] ?? 0) : null;
                  const sd = tv !== null && !isTarget ? val - tv : null;
                  return (
                    <div key={sub.key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, paddingLeft: 8 }}>
                      <span style={{ fontSize: 8, color: '#444', width: 130, flexShrink: 0 }}>{sub.label}</span>
                      <div style={{ flex: 1, height: 3, background: '#141414', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.round(val * 0.9)}%`, background: g.color, opacity: 0.55 }} />
                      </div>
                      {sd !== null && (
                        <span style={{ fontSize: 8, color: sd > 0 ? '#4ade80' : sd < 0 ? '#f87171' : '#555', width: 24, textAlign: 'right' }}>
                          {sd > 0 ? `+${sd}` : sd === 0 ? '' : sd}
                        </span>
                      )}
                      <span style={{ fontSize: 9, color: '#888', width: 22, textAlign: 'right' }}>{val}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Mini metric bars (6 categories) ──────────────────────────────────────────
const CAT_SHORT = { playmaking: 'PM', shooting: 'SH', finishing: 'FN', rebounding: 'RB', interiorDef: 'ID', perimDef: 'PD' };

function MiniMetricBars({ player }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {CATEGORY_GROUPS.map(m => (
        <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, color: '#666', width: 18, flexShrink: 0, fontWeight: 500 }}>
            {CAT_SHORT[m.key]}
          </span>
          <div style={{ flex: 1, height: 4, background: '#222', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${player[m.key]}%`, background: m.color, borderRadius: 2 }} />
          </div>
          <span style={{ fontSize: 9, color: '#555', width: 22, textAlign: 'right' }}>{player[m.key]}</span>
        </div>
      ))}
    </div>
  );
}

// ── Full player list (default view) ──────────────────────────────────────────
function PlayerListView({ onSelect }) {
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState('');
  const [sortBy, setSortBy] = useState('eff');

  const available = useMemo(() => {
    return ALL_PLAYERS
      .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))
      .filter(p => !pos || p.pos === pos)
      .sort((a, b) => (b[sortBy] ?? 0) - (a[sortBy] ?? 0));
  }, [search, pos, sortBy]);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#0d0d0d', zIndex: 1,
      display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px',
        borderBottom: '1px solid #1e1e1e', flexShrink: 0,
      }}>
        <div>
          <p style={{ fontSize: 9, color: '#555', margin: 0, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Player Comparison</p>
          <p style={{ fontSize: 15, color: 'white', fontWeight: 700, margin: '2px 0 0' }}>Select a player to compare</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', gap: 8, padding: '12px 20px',
        borderBottom: '1px solid #1a1a1a', flexShrink: 0,
      }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search players..."
          style={{
            flex: 1, background: '#141414', border: '1px solid #2a2a2a', borderRadius: 8,
            color: 'white', fontSize: 13, padding: '8px 12px', outline: 'none',
          }}
        />
        <select
          value={pos}
          onChange={e => setPos(e.target.value)}
          style={{
            background: '#141414', border: '1px solid #2a2a2a', borderRadius: 8,
            color: pos ? 'white' : '#555', fontSize: 12, padding: '8px 10px', cursor: 'pointer',
          }}
        >
          <option value="">All positions</option>
          {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          style={{
            background: '#141414', border: '1px solid #2a2a2a', borderRadius: 8,
            color: '#aaa', fontSize: 12, padding: '8px 10px', cursor: 'pointer', maxWidth: 160,
          }}
        >
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Player list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px' }}>
        {available.map(player => {
          const pc = POS_COLORS[player.pos] || { bg: '#1a1a1a', text: '#888' };
          return (
            <div
              key={player.id}
              onClick={() => onSelect(player)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0',
                borderBottom: '1px solid #141414', cursor: 'pointer',
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: pc.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: pc.text }}>{player.pos}</span>
              </div>
              <div style={{ width: 160, flexShrink: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: 0 }}>{player.name}</p>
                <p style={{ fontSize: 10, color: '#555', margin: '2px 0 0' }}>
                  {player.team} · {player.min ? `${player.min} mpg` : ''}
                </p>
              </div>
              <div style={{ width: 40, flexShrink: 0, textAlign: 'center' }}>
                <p style={{ fontSize: 20, fontWeight: 800, color: 'white', margin: 0 }}>{player.eff}</p>
                <p style={{ fontSize: 8, color: '#444', margin: 0 }}>EFF</p>
              </div>
              <div style={{ flex: 1 }}>
                <MiniMetricBars player={player} />
              </div>
            </div>
          );
        })}
        {available.length === 0 && (
          <p style={{ color: '#333', textAlign: 'center', marginTop: 40, fontSize: 13 }}>
            No players match your filters
          </p>
        )}
      </div>
    </div>
  );
}

// ── Category legend ───────────────────────────────────────────────────────────
function CategoryLegend() {
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
      {CATEGORY_GROUPS.map(g => (
        <span key={g.key} style={{ fontSize: 9, color: g.color, fontWeight: 700 }}>
          ▬ {g.label}
        </span>
      ))}
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────
export default function PlayerComparisonTab() {
  const [target, setTarget] = useState(null);
  const [overlayPlayer, setOverlayPlayer] = useState(null);

  const comparisons = useMemo(() => {
    if (!target) return [];
    return findSimilarPlayers(target, ALL_PLAYERS, 10);
  }, [target]);

  // No target selected → full player list
  if (!target) {
    return <PlayerListView onSelect={p => setTarget(p)} />;
  }

  // Target selected → orbital view
  return (
    <div style={{
      padding: '14px 20px', fontFamily: 'system-ui, sans-serif',
      background: '#0d0d0d', minHeight: '100vh',
    }}>
      {/* Back button */}
      <button
        onClick={() => { setTarget(null); setOverlayPlayer(null); }}
        style={{
          background: 'none', border: '1px solid #2a2a2a', borderRadius: 8,
          color: '#888', fontSize: 12, padding: '6px 14px', cursor: 'pointer', marginBottom: 14,
        }}
      >
        ← All Players
      </button>

      {/* Target header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, color: POS_CLR[target.pos] ?? '#aaa', fontWeight: 700 }}>
            {target.name.split(' ')[0]}
          </div>
          <div style={{ fontSize: 22, color: 'white', fontWeight: 900 }}>
            {lastName(target.name).toUpperCase()}
          </div>
          <div style={{ fontSize: 10, color: '#555' }}>{target.pos} · {target.team}</div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 32, color: 'white', fontWeight: 900, lineHeight: 1 }}>{target.eff}</div>
          <div style={{ fontSize: 8, color: '#444', fontWeight: 700 }}>OVR</div>
        </div>
      </div>

      <CategoryLegend />
      <OrbitalDisplay target={target} comparisons={comparisons} onSelectPlayer={p => setOverlayPlayer(p)} />

      {overlayPlayer && (
        <PlayerOverlay
          player={overlayPlayer}
          target={target}
          onClose={() => setOverlayPlayer(null)}
        />
      )}
    </div>
  );
}
