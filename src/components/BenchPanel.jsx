import React, { useState } from 'react';
import { CATEGORY_GROUPS, deriveParentScores, lastName } from '../utils/metrics';

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

const SLOT_COLOR = '#6b7280';

function BenchSlot({ index, player, onSlotClick, onRemove }) {
  const [expanded, setExpanded] = useState({});
  const toggleCat = (catKey) => setExpanded(prev => ({ ...prev, [catKey]: !prev[catKey] }));

  if (!player) {
    return (
      <div
        onClick={() => onSlotClick(index)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 0', borderBottom: '1px solid #1a1a1a',
          cursor: 'pointer', opacity: 0.4,
        }}
      >
        <div style={{ width: 72, flexShrink: 0 }}>
          <p style={{ fontSize: 9, color: SLOT_COLOR, fontWeight: 600, margin: 0 }}>
            BENCH {index + 1}
          </p>
          <p style={{ fontSize: 11, color: '#333', margin: '2px 0 0' }}>+ Add player</p>
        </div>
        <div style={{ flex: 1, display: 'flex', gap: 4 }}>
          {CATEGORY_GROUPS.map(g => (
            <div key={g.key} style={{ flex: 1, height: 4, background: '#1a1a1a', borderRadius: 2 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid #1a1a1a' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Info column */}
        <div style={{ width: 72, flexShrink: 0, cursor: 'pointer' }} onClick={() => onSlotClick(index)}>
          <p style={{ fontSize: 9, color: SLOT_COLOR, fontWeight: 600, margin: 0 }}>BENCH {index + 1}</p>
          <p style={{ fontSize: 9, color: '#888', margin: '2px 0 0' }}>{player.name.split(' ')[0]}</p>
          <p style={{ fontSize: 12, color: 'white', fontWeight: 700, margin: 0 }}>
            {lastName(player.name)}
          </p>
          <p style={{ fontSize: 9, color: '#555', margin: 0 }}>{player.pos} · {player.team}</p>
          <button
            onClick={e => { e.stopPropagation(); onRemove(index); }}
            style={{
              marginTop: 4, background: 'none', border: '1px solid #2a2a2a', borderRadius: 4,
              color: '#444', fontSize: 8, padding: '2px 5px', cursor: 'pointer',
            }}
          >Remove</button>
        </div>

        {/* Category bars */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {CATEGORY_GROUPS.map(g => {
            const score = player[g.key] ?? 0;
            return (
              <div key={g.key}>
                <div
                  onClick={() => toggleCat(g.key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}
                >
                  <span style={{ fontSize: 8, color: g.color, fontWeight: 700, width: 18, flexShrink: 0 }}>
                    {CAT_SHORT[g.key]}
                  </span>
                  <div style={{ flex: 1, height: 4, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.round(score * 0.9)}%`, background: g.color, opacity: 0.8, borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 8, color: g.color, width: 22, textAlign: 'right' }}>{score}</span>
                  <span style={{ fontSize: 7, color: '#333', width: 8 }}>{expanded[g.key] ? '▲' : '▼'}</span>
                </div>
                {expanded[g.key] && g.subcategories.map(sub => {
                  const val = player[sub.key] ?? 0;
                  return (
                    <div key={sub.key} style={{ display: 'flex', alignItems: 'center', gap: 5, paddingLeft: 8, paddingTop: 2 }}>
                      <span style={{ fontSize: 7, color: '#444', width: 16 }}>{SUB_SHORT[sub.key]}</span>
                      <div style={{ flex: 1, height: 2.5, background: '#181818', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.round(val * 0.9)}%`, background: g.color, opacity: 0.6, borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 7, color: '#444', width: 22, textAlign: 'right' }}>{val}</span>
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

export default function BenchPanel({ bench, onSlotClick, onRemove }) {
  return (
    <div style={{ padding: '8px 20px 12px', fontFamily: 'system-ui, sans-serif' }}>
      <p style={{
        fontSize: 9, color: '#333', fontWeight: 700, letterSpacing: '0.08em',
        margin: '0 0 8px', textTransform: 'uppercase',
      }}>Bench</p>
      {bench.map((player, i) => (
        <BenchSlot
          key={i}
          index={i}
          player={player}
          onSlotClick={onSlotClick}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}
