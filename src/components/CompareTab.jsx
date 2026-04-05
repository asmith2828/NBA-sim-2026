import React, { useState } from 'react';
import MetricBars from './MetricBars';
import { CATEGORY_GROUPS, POS_COLORS } from '../utils/metrics';

function PlayerSlot({ player, label, onRemove, onPick, allPlayers, takenId }) {
  const [picking, setPicking] = useState(false);
  const posColor = player ? (POS_COLORS[player.pos] || POS_COLORS.PG) : null;

  if (!player) {
    return (
      <div>
        <div
          onClick={() => setPicking((v) => !v)}
          style={{
            background: 'var(--color-background-secondary)',
            border: '0.5px dashed var(--color-border-secondary)',
            borderRadius: 12,
            padding: '1rem',
            minHeight: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--color-text-tertiary)',
            fontSize: 13,
            marginBottom: 8,
          }}
        >
          + Add player {label}
        </div>
        {picking && (
          <div style={{
            background: 'var(--color-background-primary)',
            border: '0.5px solid var(--color-border-secondary)',
            borderRadius: 12,
            padding: '1rem',
          }}>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 8 }}>Select a player:</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {allPlayers
                .filter((p) => p.id !== takenId)
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { onPick(p.id); setPicking(false); }}
                    style={{
                      fontSize: 12,
                      padding: '4px 10px',
                      border: '0.5px solid var(--color-border-secondary)',
                      borderRadius: 8,
                      background: 'none',
                      color: 'var(--color-text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {p.name}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--color-background-primary)',
      border: '0.5px solid var(--color-border-tertiary)',
      borderRadius: 12,
      padding: '1rem 1.25rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>{player.name}</p>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{player.team}</span>
            <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 10, background: posColor.bg, color: posColor.text }}>{player.pos}</span>
          </div>
        </div>
        <button
          onClick={onRemove}
          style={{ fontSize: 11, color: 'var(--color-text-secondary)', cursor: 'pointer', background: 'none', border: 'none' }}
        >
          remove ×
        </button>
      </div>
      <div style={{ textAlign: 'center', borderBottom: '0.5px solid var(--color-border-tertiary)', paddingBottom: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 28, fontWeight: 500, color: 'var(--color-text-primary)' }}>{player.eff}</div>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>effectiveness score</div>
      </div>
      <MetricBars player={player} compact />
    </div>
  );
}

export default function CompareTab({ players, compareIds, onRemove, onPick }) {
  const [a, b] = compareIds;
  const playerA = players.find((p) => p.id === a) || null;
  const playerB = players.find((p) => p.id === b) || null;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <PlayerSlot
          player={playerA}
          label="A"
          onRemove={() => onRemove('A')}
          onPick={(id) => onPick('A', id)}
          allPlayers={players}
          takenId={b}
        />
        <PlayerSlot
          player={playerB}
          label="B"
          onRemove={() => onRemove('B')}
          onPick={(id) => onPick('B', id)}
          allPlayers={players}
          takenId={a}
        />
      </div>

      {/* Side-by-side subcategory breakdown */}
      {playerA && playerB ? (
        <div style={{
          background: 'var(--color-background-primary)',
          border: '0.5px solid var(--color-border-tertiary)',
          borderRadius: 12,
          padding: '1rem 1.25rem',
        }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 14 }}>
            Subcategory breakdown
          </p>

          {CATEGORY_GROUPS.map((group) => {
            const pAval = playerA[group.key];
            const pBval = playerB[group.key];
            const catWinner = pAval > pBval ? 'A' : pBval > pAval ? 'B' : null;
            return (
              <div key={group.key} style={{ marginBottom: 14 }}>
                {/* Category header row */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 100px 1fr',
                  gap: 8,
                  alignItems: 'center',
                  marginBottom: 6,
                  paddingBottom: 4,
                  borderBottom: `1px solid ${group.color}33`,
                }}>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      fontSize: 13,
                      fontWeight: catWinner === 'A' ? 700 : 400,
                      color: catWinner === 'A' ? group.color : 'var(--color-text-secondary)',
                    }}>
                      {pAval}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: group.color,
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    {group.label}
                  </div>
                  <div>
                    <span style={{
                      fontSize: 13,
                      fontWeight: catWinner === 'B' ? 700 : 400,
                      color: catWinner === 'B' ? group.color : 'var(--color-text-secondary)',
                    }}>
                      {pBval}
                    </span>
                  </div>
                </div>

                {/* Subcategory rows */}
                {group.subcategories.map((sub) => {
                  const av = playerA[sub.key] ?? 0;
                  const bv = playerB[sub.key] ?? 0;
                  const winner = av > bv ? 'A' : bv > av ? 'B' : null;
                  return (
                    <div key={sub.key} style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 100px 1fr',
                      gap: 8,
                      alignItems: 'center',
                      marginBottom: 6,
                    }}>
                      {/* Left bar (player A) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
                        <span style={{
                          fontSize: 11,
                          fontWeight: winner === 'A' ? 600 : 400,
                          color: winner === 'A' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                        }}>
                          {av}
                        </span>
                        <div style={{
                          width: Math.round(av * 0.9),
                          maxWidth: 90,
                          minWidth: 3,
                          height: 5,
                          borderRadius: 3,
                          background: group.color,
                          opacity: winner === 'A' ? 1 : 0.5,
                        }} />
                      </div>

                      {/* Label */}
                      <div style={{
                        fontSize: 10,
                        color: 'var(--color-text-tertiary)',
                        textAlign: 'center',
                        lineHeight: 1.3,
                      }}>
                        {sub.label}
                      </div>

                      {/* Right bar (player B) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{
                          width: Math.round(bv * 0.9),
                          maxWidth: 90,
                          minWidth: 3,
                          height: 5,
                          borderRadius: 3,
                          background: group.color,
                          opacity: winner === 'B' ? 1 : 0.5,
                        }} />
                        <span style={{
                          fontSize: 11,
                          fontWeight: winner === 'B' ? 600 : 400,
                          color: winner === 'B' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                        }}>
                          {bv}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      ) : (
        <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '2rem 0' }}>
          Select two players above to compare their metrics side by side.
        </p>
      )}
    </div>
  );
}
