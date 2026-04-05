import React from 'react';
import { CATEGORY_GROUPS } from '../utils/metrics';

// Renders 18 subcategory bars grouped under their 6 parent categories.
// Each category shows: colored header with parent score + 3 indented sub-bars.
// Pass `compact` for smaller text (used in comparison slots).
export default function MetricBars({ player, compact = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 6 : 8 }}>
      {CATEGORY_GROUPS.map((group) => {
        const parentScore = player[group.key] ?? 0;
        return (
          <div key={group.key}>
            {/* ── Category header ── */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: compact ? 3 : 4,
            }}>
              <span style={{
                fontSize: compact ? 9 : 10,
                fontWeight: 600,
                color: group.color,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}>
                {group.label}
              </span>
              <span style={{
                fontSize: compact ? 10 : 11,
                fontWeight: 600,
                color: group.color,
              }}>
                {parentScore}
              </span>
            </div>

            {/* ── 3 subcategory bars ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 3 : 4, paddingLeft: 8 }}>
              {group.subcategories.map((sub) => {
                const val = player[sub.key] ?? 0;
                return (
                  <div key={sub.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontSize: compact ? 9 : 10,
                      color: 'var(--color-text-tertiary, #888)',
                      width: compact ? 80 : 96,
                      flexShrink: 0,
                    }}>
                      {sub.label}
                    </span>
                    <div style={{
                      flex: 1,
                      height: compact ? 4 : 4,
                      background: 'var(--color-background-tertiary, #eee)',
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${val}%`,
                        background: group.color,
                        borderRadius: 2,
                        opacity: 0.75,
                        transition: 'width 0.3s',
                      }} />
                    </div>
                    <span style={{
                      fontSize: compact ? 9 : 10,
                      color: 'var(--color-text-secondary, #666)',
                      width: 24,
                      textAlign: 'right',
                    }}>
                      {val}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
