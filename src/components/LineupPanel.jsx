import React, { useState } from 'react';
import { CATEGORY_GROUPS, calcEffectiveness, lastName } from '../utils/metrics';
import { applyChemistry } from '../utils/chemistry';
import { SLOT_DEFS } from './Court';

const CAT_SHORT = {
  playmaking: 'PM', shooting: 'SH', finishing: 'FN',
  rebounding: 'RB', interiorDef: 'ID', perimDef: 'PD',
};
const SUB_SHORT = {
  decisionQuality: 'DQ', ballMovement: 'BM', courtVision: 'CV',
  shotQuality: 'SQ', shotCreation: 'SC', shootingGravity: 'GR',
  paintEfficiency: 'PE', driveImpact: 'DI', transitionScoring: 'TR',
  offRebounding: 'OR', defRebounding: 'DR', reboundPositioning: 'RP',
  rimProtection: 'RI', paintDeterrence: 'PD', interiorPositioning: 'IP',
  onBallPressure: 'OB', offBallAwareness: 'OA', schemeVersatility: 'SV',
};

function CategoryBar({ group, base, boosted, expanded, onToggle }) {
  const baseScore = base[group.key] ?? 0;
  const boostedScore = boosted ? (boosted[group.key] ?? 0) : baseScore;
  const delta = boostedScore - baseScore;
  const displayScore = boostedScore;

  return (
    <div>
      {/* Category header row — clickable to expand */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
          padding: '3px 0', userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 9, color: group.color, fontWeight: 700, width: 20, flexShrink: 0 }}>
          {CAT_SHORT[group.key]}
        </span>
        <div style={{ flex: 1, height: 5, background: '#1e1e1e', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
          <div style={{ height: '100%', width: `${Math.round(displayScore * 0.9)}%`, background: group.color, borderRadius: 3, opacity: 0.85 }} />
        </div>
        <span style={{ fontSize: 9, color: group.color, width: 28, textAlign: 'right', fontWeight: 700 }}>
          {displayScore}{delta > 0 ? <span style={{ color: '#6ee7b7', fontSize: 8 }}> +{delta}</span> : null}
        </span>
        <span style={{ fontSize: 8, color: '#333', width: 8 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Subcategory rows — visible when expanded */}
      {expanded && group.subcategories.map(sub => {
        const baseVal = base[sub.key] ?? 0;
        const boostedVal = boosted ? (boosted[sub.key] ?? baseVal) : baseVal;
        const subDelta = boostedVal - baseVal;
        return (
          <div key={sub.key} style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 8, paddingBottom: 3 }}>
            <span style={{ fontSize: 8, color: '#555', width: 18, flexShrink: 0 }}>{SUB_SHORT[sub.key]}</span>
            <div style={{ flex: 1, height: 3, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
              {/* Base tick when there's a boost */}
              {subDelta > 0 && (
                <div style={{
                  position: 'absolute', left: `${Math.round(baseVal * 0.9)}%`,
                  top: 0, width: 1.5, height: '100%', background: 'rgba(255,255,255,0.5)',
                }} />
              )}
              <div style={{
                height: '100%',
                width: `${Math.round(boostedVal * 0.9)}%`,
                background: subDelta > 0 ? group.color : group.color,
                borderRadius: 2,
                opacity: subDelta > 0 ? 1 : 0.6,
              }} />
            </div>
            <span style={{ fontSize: 8, color: subDelta > 0 ? group.color : '#444', width: 28, textAlign: 'right' }}>
              {boostedVal}{subDelta > 0 ? <span style={{ color: '#6ee7b7', fontSize: 7 }}> +{subDelta}</span> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PlayerRow({ slotDef, player, boostedPlayer, onRemove }) {
  const { color, label, key } = slotDef;
  const [expanded, setExpanded] = useState({});
  const toggleCat = (catKey) => setExpanded(prev => ({ ...prev, [catKey]: !prev[catKey] }));

  if (!player) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 0', borderBottom: '1px solid #1a1a1a', opacity: 0.35,
      }}>
        <div style={{ width: 86, flexShrink: 0 }}>
          <p style={{ fontSize: 10, color: color, fontWeight: 600, margin: 0 }}>{label.toUpperCase()}</p>
          <p style={{ fontSize: 11, color: '#333', margin: '2px 0 0' }}>Empty slot</p>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {CATEGORY_GROUPS.map(g => (
            <div key={g.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 9, color: '#222', width: 20 }}>{CAT_SHORT[g.key]}</span>
              <div style={{ flex: 1, height: 5, background: '#1a1a1a', borderRadius: 3 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const base = player;
  const boosted = boostedPlayer;
  // Use rescaled player.eff as base; compute delta from raw formula for chemistry boost
  const baseRaw   = calcEffectiveness(base);
  const boostedRaw = boosted ? calcEffectiveness(boosted) : baseRaw;
  const effDelta   = Math.round(boostedRaw - baseRaw);
  const boostedEff = Math.round(Math.min(99, base.eff + effDelta));

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid #1a1a1a' }}>
      {/* Player info */}
      <div style={{ width: 86, flexShrink: 0 }}>
        <p style={{ fontSize: 10, color: color, fontWeight: 600, margin: 0 }}>{label.toUpperCase()}</p>
        <p style={{ fontSize: 10, color: '#888', margin: '2px 0 0' }}>{player.name.split(' ')[0]}</p>
        <p style={{ fontSize: 13, color: 'white', fontWeight: 700, margin: 0 }}>{lastName(player.name)}</p>
        <p style={{ fontSize: 18, color: 'white', fontWeight: 800, margin: '4px 0 0' }}>
          {boostedEff}
          {effDelta > 0 && <span style={{ fontSize: 10, color: '#6ee7b7' }}> +{effDelta}</span>}
        </p>
        <p style={{ fontSize: 9, color: '#444', margin: 0 }}>EFF</p>
        <button
          onClick={() => onRemove(key)}
          style={{
            marginTop: 6, background: 'none', border: '1px solid #2a2a2a', borderRadius: 4,
            color: '#444', fontSize: 9, padding: '2px 6px', cursor: 'pointer',
          }}
        >Remove</button>
      </div>

      {/* Category bars (expandable) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {CATEGORY_GROUPS.map(g => (
          <CategoryBar
            key={g.key}
            group={g}
            base={base}
            boosted={boosted}
            expanded={!!expanded[g.key]}
            onToggle={() => toggleCat(g.key)}
          />
        ))}
      </div>
    </div>
  );
}

export default function LineupPanel({ lineup, onRemove }) {
  const slotOrder = ['PG', 'SG', 'SF', 'PF', 'C'];
  const filledCount = slotOrder.filter(k => lineup[k]).length;

  return (
    <div style={{ padding: '12px 20px', fontFamily: 'system-ui, sans-serif' }}>
      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginBottom: 12 }}>
        {CATEGORY_GROUPS.map(g => (
          <span key={g.key} style={{ fontSize: 9, color: g.color, fontWeight: 600 }}>
            {CAT_SHORT[g.key]} = {g.label}
          </span>
        ))}
        <span style={{ fontSize: 9, color: '#333', marginLeft: 4 }}>· click category to expand subcategories</span>
      </div>

      {/* Stat rows */}
      {slotOrder.map(slotKey => {
        const slotDef = SLOT_DEFS.find(s => s.key === slotKey);
        const player = lineup[slotKey];
        const teammates = slotOrder
          .filter(k => k !== slotKey && lineup[k])
          .map(k => lineup[k]);
        const boostedPlayer = player ? applyChemistry(player, teammates) : null;

        return (
          <PlayerRow
            key={slotKey}
            slotDef={slotDef}
            player={player}
            boostedPlayer={boostedPlayer}
            onRemove={onRemove}
          />
        );
      })}

      {/* Team totals */}
      {filledCount > 0 && (
        <div style={{
          marginTop: 12, padding: '10px 14px', background: '#111', borderRadius: 8,
          display: 'flex', gap: 16, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 10, color: '#555', fontWeight: 600 }}>TEAM TOTALS</span>
          {CATEGORY_GROUPS.map(g => {
            const players = slotOrder.filter(k => lineup[k]).map(k => lineup[k]);
            if (players.length === 0) return null;
            const avg = Math.round(players.reduce((s, p) => s + (p[g.key] ?? 0), 0) / players.length);
            return (
              <span key={g.key} style={{ fontSize: 10, color: g.color }}>
                {CAT_SHORT[g.key]}: <strong>{avg}</strong>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
