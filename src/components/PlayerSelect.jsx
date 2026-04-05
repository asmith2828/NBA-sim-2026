import React, { useState } from 'react';
import { ALL_PLAYERS } from '../data/normalizedPlayers';
import {
  METRICS, POSITIONS, POS_COLORS, SORT_OPTIONS,
} from '../utils/metrics';
import { getChemistryLabel } from '../utils/chemistry';

function MiniMetricBars({ player }) {
  const SHORT = { playmaking: 'PM', shooting: 'SH', finishing: 'FN', rebounding: 'RB', interiorDef: 'ID', perimDef: 'PD' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {METRICS.map(m => (
        <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, color: '#666', width: 18, flexShrink: 0, fontWeight: 500 }}>
            {SHORT[m.key] || m.key.slice(0, 2).toUpperCase()}
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

export default function PlayerSelect({ slotKey, slotLabel, takenIds, onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState('');
  const [sortBy, setSortBy] = useState('eff');

  const available = ALL_PLAYERS
    .filter(p => !takenIds.includes(p.id))
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .filter(p => !pos || p.pos === pos)
    .sort((a, b) => (b[sortBy] ?? 0) - (a[sortBy] ?? 0));

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#0d0d0d', zIndex: 100,
      display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px',
        borderBottom: '1px solid #1e1e1e', flexShrink: 0,
      }}>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: '1px solid #2a2a2a', borderRadius: 8,
            color: '#888', fontSize: 13, padding: '6px 12px', cursor: 'pointer',
          }}
        >← Back</button>
        <div>
          <p style={{ fontSize: 11, color: '#555', margin: 0 }}>Selecting for</p>
          <p style={{ fontSize: 15, color: 'white', fontWeight: 700, margin: 0 }}>{slotLabel}</p>
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
              {/* Position badge */}
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: pc.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: pc.text }}>{player.pos}</span>
              </div>
              {/* Name + team */}
              <div style={{ width: 160, flexShrink: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: 0 }}>{player.name}</p>
                <p style={{ fontSize: 10, color: '#555', margin: '2px 0 0' }}>
                  {player.team} · {getChemistryLabel(player.id)}
                </p>
              </div>
              {/* Eff score */}
              <div style={{ width: 40, flexShrink: 0, textAlign: 'center' }}>
                <p style={{ fontSize: 20, fontWeight: 800, color: 'white', margin: 0 }}>{player.eff}</p>
                <p style={{ fontSize: 8, color: '#444', margin: 0 }}>EFF</p>
              </div>
              {/* Mini bars */}
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
