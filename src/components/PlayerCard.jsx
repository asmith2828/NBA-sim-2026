import React from 'react';
import MetricBars from './MetricBars';
import { POS_COLORS } from '../utils/metrics';

export default function PlayerCard({ player, isSelected, onCompare }) {
  const posColor = POS_COLORS[player.pos] || POS_COLORS.PG;

  return (
    <div style={{
      background: 'var(--color-background-primary)',
      border: isSelected ? '1.5px solid #3266ad' : '0.5px solid var(--color-border-tertiary)',
      borderRadius: 12,
      padding: '1rem 1.25rem',
      cursor: 'default',
      transition: 'border-color 0.15s',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>
            {player.name}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{player.team}</span>
            <span style={{
              fontSize: 10,
              fontWeight: 500,
              padding: '2px 7px',
              borderRadius: 10,
              background: posColor.bg,
              color: posColor.text,
            }}>
              {player.pos}
            </span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--color-text-primary)', lineHeight: 1 }}>
            {player.eff}
          </div>
          <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 2 }}>eff score</div>
        </div>
      </div>

      {/* Metric bars */}
      <MetricBars player={player} />

      {/* Actions */}
      <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
        <button
          onClick={() => onCompare(player.id)}
          style={{
            fontSize: 11,
            padding: '4px 10px',
            border: '0.5px solid var(--color-border-secondary)',
            borderRadius: 8,
            background: isSelected ? 'var(--color-background-secondary)' : 'none',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
          }}
        >
          {isSelected ? '✓ In compare' : '+ Compare'}
        </button>
      </div>
    </div>
  );
}
