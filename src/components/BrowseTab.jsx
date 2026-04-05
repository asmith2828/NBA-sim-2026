import React, { useState } from 'react';
import PlayerCard from './PlayerCard';
import { POSITIONS, SORT_OPTIONS } from '../utils/metrics';

export default function BrowseTab({ players, compareIds, onCompare }) {
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState('');
  const [sortBy, setSortBy] = useState('eff');

  const filtered = players
    .filter((p) => {
      const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
      const matchesPos = !pos || p.pos === pos;
      return matchesSearch && matchesPos;
    })
    .sort((a, b) => b[sortBy] - a[sortBy]);

  const selectStyle = {
    padding: '8px 10px',
    fontSize: 13,
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 8,
    background: 'var(--color-background-primary)',
    color: 'var(--color-text-primary)',
  };

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search player..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            minWidth: 160,
            padding: '8px 12px',
            fontSize: 14,
            border: '0.5px solid var(--color-border-secondary)',
            borderRadius: 8,
            background: 'var(--color-background-primary)',
            color: 'var(--color-text-primary)',
          }}
        />
        <select value={pos} onChange={(e) => setPos(e.target.value)} style={selectStyle}>
          <option value="">All positions</option>
          {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={selectStyle}>
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>Sort: {o.label}</option>
          ))}
        </select>
      </div>

      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: 12,
      }}>
        {filtered.map((p) => (
          <PlayerCard
            key={p.id}
            player={p}
            isSelected={compareIds.includes(p.id)}
            onCompare={onCompare}
          />
        ))}
        {filtered.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', padding: '2rem 0' }}>
            No players match your filters.
          </p>
        )}
      </div>
    </div>
  );
}
