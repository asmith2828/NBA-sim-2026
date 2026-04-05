import React, { useState } from 'react';
import { METRICS, SORT_OPTIONS, POS_COLORS } from '../utils/metrics';

export default function LeadersTab({ players }) {
  const [metric, setMetric] = useState('eff');

  const sorted = [...players].sort((a, b) => b[metric] - a[metric]);

  return (
    <div>
      {/* Metric selector */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {SORT_OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => setMetric(o.value)}
            style={{
              fontSize: 11,
              padding: '4px 12px',
              border: '0.5px solid var(--color-border-secondary)',
              borderRadius: 8,
              background: metric === o.value ? 'var(--color-background-secondary)' : 'none',
              color: metric === o.value ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              fontWeight: metric === o.value ? 500 : 400,
              cursor: 'pointer',
            }}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={thStyle('#', 36)}>#</th>
              <th style={thStyle('Player', null, 'left')}>Player</th>
              <th style={thStyle('Pos', 48)}>Pos</th>
              <th style={thStyle('Team', 52)}>Team</th>
              {SORT_OPTIONS.map((o) => (
                <th
                  key={o.value}
                  style={{
                    ...thBase,
                    textAlign: 'right',
                    width: 72,
                    color: metric === o.value ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    fontWeight: metric === o.value ? 500 : 400,
                  }}
                >
                  {o.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => {
              const posColor = POS_COLORS[p.pos] || POS_COLORS.PG;
              return (
                <tr key={p.id} style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                  <td style={{ ...tdBase, textAlign: 'right', fontSize: 11, color: 'var(--color-text-tertiary)' }}>{i + 1}</td>
                  <td style={{ ...tdBase, fontWeight: 500 }}>{p.name}</td>
                  <td style={{ ...tdBase, textAlign: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 6px', borderRadius: 10, background: posColor.bg, color: posColor.text }}>
                      {p.pos}
                    </span>
                  </td>
                  <td style={{ ...tdBase, fontSize: 12, color: 'var(--color-text-secondary)' }}>{p.team}</td>
                  {SORT_OPTIONS.map((o) => (
                    <td
                      key={o.value}
                      style={{
                        ...tdBase,
                        textAlign: 'right',
                        fontWeight: metric === o.value ? 500 : 400,
                        color: metric === o.value ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                      }}
                    >
                      {p[o.value]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thBase = {
  fontSize: 11,
  color: 'var(--color-text-secondary)',
  fontWeight: 500,
  padding: '6px 10px',
  borderBottom: '0.5px solid var(--color-border-tertiary)',
};

function thStyle(label, width, align = 'right') {
  return { ...thBase, textAlign: align, ...(width ? { width } : {}) };
}

const tdBase = {
  fontSize: 13,
  color: 'var(--color-text-primary)',
  padding: '9px 10px',
};
