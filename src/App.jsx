import React, { useState, useEffect, useRef } from 'react';
import Court from './components/Court';
import PlayerSelect from './components/PlayerSelect';
import MatchupTab from './components/MatchupTab';
import PlayerComparisonTab from './components/PlayerComparisonTab';
import { SLOT_DEFS } from './components/Court';
import { NBA_TEAMS } from './data/teams';
import { ALL_PLAYERS } from './data/normalizedPlayers';
import { POS_COLORS, CATEGORY_GROUPS, lastName } from './utils/metrics';
import { applyChemistry, CHEMISTRY_PROFILES, getChemistryLabel } from './utils/chemistry';
import './mobile.css';
import { getTeamColor, NBA_TEAM_COLORS } from './data/teamColors';

const BENCH_SIZE = 5;

const globalStyle = document.createElement('style');
globalStyle.textContent = `
  html, body, #root {
    background: #0d0d0d !important;
    color: white;
    margin: 0; padding: 0;
    font-family: system-ui, -apple-system, sans-serif;
  }
  * { box-sizing: border-box; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: #111; }
  ::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 2px; }
  select option { background: #1a1a1a; color: white; }
  input::placeholder { color: #444; }
`;
document.head.appendChild(globalStyle);

function getPlayerById(id) {
  return ALL_PLAYERS.find(p => p.id === id) || null;
}
function loadSavedTeams() {
  try { return JSON.parse(localStorage.getItem('nba_saved_teams') || '{}'); }
  catch { return {}; }
}

// ── Inches → feet/inches string ───────────────────────────────────────────────
function inchesToFt(inches) {
  if (!inches) return '';
  const ft = Math.floor(inches / 12), inch = inches % 12;
  return `${ft}'${inch}"`;
}

// ── Player Card Overlay ───────────────────────────────────────────────────────
function PlayerCardOverlay({ player, onClose }) {
  if (!player) return null;
  const [expanded, setExpanded] = useState({});
  const toggleCat = (k) => setExpanded(p => ({ ...p, [k]: !p[k] }));
  const CAT_SHORT = { playmaking:'PM', shooting:'SH', finishing:'FN', rebounding:'RB', interiorDef:'ID', perimDef:'PD' };
  const SUB_SHORT = { decisionQuality:'DQ',ballMovement:'BM',courtVision:'CV',shotQuality:'SQ',shotCreation:'SC',shootingGravity:'GR',paintEfficiency:'PE',driveImpact:'DI',transitionScoring:'TR',offRebounding:'OR',defRebounding:'DR',reboundPositioning:'RP',rimProtection:'RI',paintDeterrence:'PD',interiorPositioning:'IP',onBallPressure:'OB',offBallAwareness:'OA',schemeVersatility:'SV' };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.86)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 14, width: '100%', maxWidth: 440, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #1e1e1e', flexShrink: 0, position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 10, color: '#666', marginBottom: 2 }}>{player.name.split(' ')[0]}</div>
              <div style={{ fontSize: 22, color: 'white', fontWeight: 900, lineHeight: 1 }}>{lastName(player.name).toUpperCase()}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 5, alignItems: 'center' }}>
                <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, background: '#1a3a2a', color: '#4ade80', fontWeight: 700 }}>{player.pos}</span>
                <span style={{ fontSize: 10, color: '#555' }}>{player.team}</span>
                {player.heightInches && <span style={{ fontSize: 10, color: '#444' }}>{inchesToFt(player.heightInches)}</span>}
                <span style={{ fontSize: 9, color: '#333' }}>{player.min ? `${player.min} mpg` : ''}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 38, color: 'white', fontWeight: 900, lineHeight: 1 }}>{player.eff}</div>
              <div style={{ fontSize: 8, color: '#444', fontWeight: 700 }}>OVERALL</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: '1px solid #2a2a2a', borderRadius: 6, color: '#555', fontSize: 14, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >✕</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '12px 16px 16px' }}>
          {CATEGORY_GROUPS.map(g => {
            const sc = player[g.key] ?? 0;
            return (
              <div key={g.key} style={{ marginBottom: 10 }}>
                <div onClick={() => toggleCat(g.key)} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, cursor: 'pointer' }}>
                  <span style={{ fontSize: 9, color: g.color, fontWeight: 700, width: 20 }}>{CAT_SHORT[g.key]}</span>
                  <span style={{ fontSize: 11, color: g.color, fontWeight: 700, flex: 1 }}>{g.label}</span>
                  <span style={{ fontSize: 9, color: '#333' }}>{expanded[g.key] ? '▲' : '▼'}</span>
                  <span style={{ fontSize: 14, color: 'white', fontWeight: 800, width: 28, textAlign: 'right' }}>{sc}</span>
                </div>
                <div style={{ height: 5, background: '#1a1a1a', borderRadius: 3, overflow: 'hidden', marginBottom: expanded[g.key] ? 6 : 0 }}>
                  <div style={{ height: '100%', width: `${Math.round(sc * 0.9)}%`, background: g.color, opacity: 0.8 }} />
                </div>
                {expanded[g.key] && g.subcategories.map(sub => {
                  const val = player[sub.key] ?? 0;
                  return (
                    <div key={sub.key} style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 8, color: '#444', width: 18 }}>{SUB_SHORT[sub.key]}</span>
                      <span style={{ fontSize: 8, color: '#333', flex: 1 }}>{sub.label}</span>
                      <div style={{ width: 80, height: 3, background: '#141414', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.round(val * 0.9)}%`, background: g.color, opacity: 0.55 }} />
                      </div>
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

// ── Big Player Card (replaces LineupPanel/BenchPanel rows) ────────────────────
function BigPlayerCard({ player, slotLabel, isBench, teamColor, onClick }) {
  if (!player) return null;
  const CARD_H = 80;
  const color = teamColor || '#4ade80';
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        background: '#111', border: `1px solid ${color}22`, borderRadius: 12,
        padding: '10px 12px', width: 120, cursor: 'pointer', flexShrink: 0,
        gap: 5, userSelect: 'none', opacity: isBench ? 0.8 : 1,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color + '55'; e.currentTarget.style.background = '#151515'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = color + '22'; e.currentTarget.style.background = '#111'; }}
    >
      {/* Name */}
      <div style={{ textAlign: 'center', lineHeight: 1.1, width: '100%' }}>
        <div style={{ fontSize: 9, color: color + '99' }}>{player.name.split(' ')[0].slice(0, 8)}</div>
        <div style={{ fontSize: 13, color: 'white', fontWeight: 800 }}>{lastName(player.name).slice(0, 10)}</div>
      </div>
      {/* Vertical bars for 6 categories */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: CARD_H }}>
        {CATEGORY_GROUPS.map(g => {
          const val = player[g.key] ?? 0;
          const barH = Math.max(3, Math.round((val / 99) * CARD_H));
          return (
            <div key={g.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <div style={{ width: 9, height: CARD_H, background: '#1a1a1a', borderRadius: 4, display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
                <div style={{ width: '100%', height: barH, background: g.color, opacity: 0.85, borderRadius: 4 }} />
              </div>
            </div>
          );
        })}
      </div>
      {/* EFF + pos + height */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 22, color: 'white', fontWeight: 900, lineHeight: 1 }}>{player.eff}</div>
        <div style={{ fontSize: 8, color: color, fontWeight: 700 }}>{player.pos}</div>
        {player.heightInches && <div style={{ fontSize: 9, color: '#444', marginTop: 1 }}>{inchesToFt(player.heightInches)}</div>}
      </div>
      {slotLabel && <div style={{ fontSize: 7, color: '#333', letterSpacing: '0.05em', fontWeight: 700 }}>{slotLabel}</div>}
    </div>
  );
}

// ── Bench Circle (column to the right of court) ───────────────────────────────
function BenchCircle({ player, index, teamColor, onClick }) {
  const color = teamColor || '#4ade80';
  const r = 32;

  if (!player) {
    return (
      <div
        onClick={onClick}
        style={{
          width: r * 2, height: r * 2, borderRadius: '50%',
          background: '#111', border: `1px solid ${color}22`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', flexShrink: 0, userSelect: 'none',
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = color + '55'}
        onMouseLeave={e => e.currentTarget.style.borderColor = color + '22'}
      >
        <span style={{ fontSize: 10, color: color + '44', fontWeight: 700 }}>+</span>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      title={player.name}
      style={{
        width: r * 2, height: r * 2, borderRadius: '50%',
        background: '#1c1c1c', border: `1.5px solid ${color}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', flexShrink: 0, userSelect: 'none', position: 'relative', overflow: 'hidden',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = color}
      onMouseLeave={e => e.currentTarget.style.border = `1.5px solid ${color}`}
    >
      <div style={{ fontSize: 7, color: color, fontWeight: 700, textAlign: 'center', lineHeight: 1 }}>
        {lastName(player.name).slice(0, 7).toUpperCase()}
      </div>
      <div style={{ fontSize: 11, color: 'white', fontWeight: 900, lineHeight: 1, marginTop: 1 }}>{player.eff}</div>
      <div style={{ fontSize: 7, color: color + '88' }}>{player.pos}</div>
    </div>
  );
}

// ── SwapPanel — shown when clicking a starter/bench slot ──────────────────────
function SwapPanel({ selectingSlot, lineup, bench, onSwap, onSearchAll, onClose }) {
  const slotDefs = {
    PG: { label: 'Point Guard', color: '#3b82f6' },
    SG: { label: 'Shooting Guard', color: '#a78bfa' },
    SF: { label: 'Small Forward', color: '#34d399' },
    PF: { label: 'Power Forward', color: '#fbbf24' },
    C:  { label: 'Center', color: '#fb923c' },
  };

  const isStarter = selectingSlot.type === 'starter';
  const slotKey   = selectingSlot.key;
  const benchIdx  = selectingSlot.index;
  const currentPlayer = isStarter ? lineup[slotKey] : bench[benchIdx];
  const swapOptions = isStarter
    ? bench.map((p, i) => ({ player: p, benchIndex: i })).filter(o => o.player)
    : Object.entries(lineup).filter(([k, v]) => v).map(([k, v]) => ({ player: v, slotKey: k }));

  const slotColor = isStarter ? (slotDefs[slotKey]?.color ?? '#aaa') : '#6b7280';
  const slotLabel = isStarter ? (slotDefs[slotKey]?.label ?? slotKey) : `Bench ${benchIdx + 1}`;

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d', padding: '16px 20px', fontFamily: 'system-ui, sans-serif' }}>
      <button onClick={onClose} style={{ background: 'none', border: '1px solid #2a2a2a', borderRadius: 8, color: '#555', fontSize: 11, padding: '6px 12px', cursor: 'pointer', marginBottom: 16 }}>← Cancel</button>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'white', margin: 0 }}>
          {slotLabel}
          {currentPlayer && <span style={{ fontSize: 12, color: slotColor, fontWeight: 400, marginLeft: 8 }}>· currently {currentPlayer.name}</span>}
        </h2>
        <p style={{ fontSize: 11, color: '#444', margin: '4px 0 0' }}>
          {isStarter ? 'Select a bench player to swap into this starter spot.' : 'Select a starter to move to the bench.'}
        </p>
      </div>
      {swapOptions.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 9, color: '#333', fontWeight: 700, letterSpacing: '0.08em', margin: '0 0 8px', textTransform: 'uppercase' }}>
            {isStarter ? 'Bench Players' : 'Starters'}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {swapOptions.map((opt, i) => {
              const p = opt.player;
              const posC = POS_COLORS[p.pos] ?? POS_COLORS.PG;
              return (
                <div key={i} onClick={() => onSwap(opt)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#111', border: '1px solid #1e1e1e', borderRadius: 8, cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = slotColor}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#1e1e1e'}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, color: '#666' }}>{p.name.split(' ')[0]}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{lastName(p.name)}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                      <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: posC.bg, color: posC.text, fontWeight: 600 }}>{p.pos}</span>
                      <span style={{ fontSize: 9, color: '#555' }}>{p.team}</span>
                      {p.heightInches && <span style={{ fontSize: 9, color: '#444' }}>{inchesToFt(p.heightInches)}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end' }}>
                    {CATEGORY_GROUPS.map(g => {
                      const h = Math.round((p[g.key] ?? 0) / 99 * 22);
                      return <div key={g.key} style={{ width: 6, height: 22, background: '#1a1a1a', borderRadius: 2, display: 'flex', alignItems: 'flex-end' }}><div style={{ width: '100%', height: h, background: g.color, borderRadius: 2, opacity: 0.8 }} /></div>;
                    })}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'white' }}>{p.eff}</div>
                    <div style={{ fontSize: 8, color: '#444' }}>EFF</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: 16, marginBottom: 4 }}>
        <p style={{ fontSize: 9, color: '#333', fontWeight: 700, letterSpacing: '0.08em', margin: '0 0 8px', textTransform: 'uppercase' }}>Or search all players</p>
        <button onClick={onSearchAll} style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 8, color: '#888', fontSize: 12, fontWeight: 600, padding: '8px 16px', cursor: 'pointer' }}>
          + Search entire league
        </button>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab]         = useState('builder');
  const [lineup, setLineup]               = useState({ PG: null, SG: null, SF: null, PF: null, C: null });
  const [bench, setBench]                 = useState(Array(BENCH_SIZE).fill(null));
  const [selectingSlot, setSelectingSlot] = useState(null);
  const [swapMode, setSwapMode]           = useState(false);
  const [savedTeams, setSavedTeams]       = useState(loadSavedTeams);
  const [saveNameInput, setSaveNameInput] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [cardOverlayPlayer, setCardOverlayPlayer] = useState(null);
  // Team color: derive from most common team in lineup/bench, or fallback
  const [activeTeamColor, setActiveTeamColor] = useState('#4ade80');
  // Rating-change delta tracking (must be declared before any early returns)
  const [ratingDeltas, setRatingDeltas] = useState(null); // { ovr, cats:{} }
  const prevRatingsRef = useRef(null);
  const deltaTimerRef  = useRef(null);

  const takenIds = [
    ...Object.values(lineup).filter(Boolean).map(p => p.id),
    ...bench.filter(Boolean).map(p => p.id),
  ];

  // ── Derive team color from loaded roster ──────────────────────────────────
  function deriveTeamColor(lineupObj, benchArr) {
    const allP = [...Object.values(lineupObj).filter(Boolean), ...benchArr.filter(Boolean)];
    if (!allP.length) return '#4ade80';
    const freq = allP.reduce((acc, p) => { acc[p.team] = (acc[p.team] || 0) + 1; return acc; }, {});
    const topTeam = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0];
    return getTeamColor(topTeam, '#4ade80');
  }

  // ── Load preset / custom team ────────────────────────────────────────────
  function loadTeam(teamId) {
    // Reset deltas — loaded team is the new baseline, not a "change"
    setRatingDeltas(null);
    prevRatingsRef.current = null;

    if (teamId === '__new__') {
      clearAll();
      setActiveTeamColor('#4ade80');
      return;
    }
    let teamData = null;
    if (teamId.startsWith('custom_')) teamData = savedTeams[teamId.slice(7)];
    else teamData = NBA_TEAMS[teamId] ?? null;
    if (!teamData) return;

    const newLineup = {};
    for (const [pos, id] of Object.entries(teamData.starters || {})) {
      newLineup[pos] = id ? getPlayerById(id) : null;
    }
    const newBench = (teamData.bench || []).map(id => id ? getPlayerById(id) : null);
    const filledBench = [...newBench, ...Array(BENCH_SIZE)].slice(0, BENCH_SIZE);
    setLineup(prev => ({ PG: null, SG: null, SF: null, PF: null, C: null, ...newLineup }));
    setBench(filledBench);

    // Set team color
    const color = teamId.startsWith('custom_')
      ? deriveTeamColor(newLineup, filledBench)
      : getTeamColor(teamId, '#4ade80');
    setActiveTeamColor(color);
  }

  function saveTeam() {
    const name = saveNameInput.trim();
    if (!name) return;
    const data = {
      starters: Object.fromEntries(Object.entries(lineup).map(([k, v]) => [k, v?.id ?? null])),
      bench: bench.map(p => p?.id ?? null),
    };
    const updated = { ...savedTeams, [name]: data };
    setSavedTeams(updated);
    localStorage.setItem('nba_saved_teams', JSON.stringify(updated));
    setSaveNameInput('');
    setShowSaveInput(false);
  }

  function handleStarterSlotClick(slotKey) {
    setSelectingSlot({ type: 'starter', key: slotKey });
    setSwapMode(true);
  }
  function handleBenchSlotClick(index) {
    setSelectingSlot({ type: 'bench', index });
    setSwapMode(true);
  }

  function handleSwap(opt) {
    if (!selectingSlot) return;
    if (selectingSlot.type === 'starter') {
      const currentStarter = lineup[selectingSlot.key];
      const benchPlayer    = opt.player;
      setLineup(prev => ({ ...prev, [selectingSlot.key]: benchPlayer }));
      const newBench = [...bench]; newBench[opt.benchIndex] = currentStarter;
      setBench(newBench);
    } else {
      const currentBench = bench[selectingSlot.index];
      const starter      = opt.player;
      setLineup(prev => ({ ...prev, [opt.slotKey]: currentBench }));
      const newBench = [...bench]; newBench[selectingSlot.index] = starter;
      setBench(newBench);
    }
    setSelectingSlot(null); setSwapMode(false);
  }

  function handlePlayerSelect(player) {
    if (!selectingSlot) return;
    let newLineup = lineup, newBench = bench;
    if (selectingSlot.type === 'starter') {
      newLineup = { ...lineup, [selectingSlot.key]: player };
      setLineup(newLineup);
    } else {
      newBench = [...bench]; newBench[selectingSlot.index] = player;
      setBench(newBench);
    }
    // Update team color when a player is added
    const c = deriveTeamColor(newLineup, newBench);
    if (c !== '#4ade80') setActiveTeamColor(c);
    setSelectingSlot(null); setSwapMode(false);
  }

  function handleRemoveStarter(slotKey) {
    const newLineup = { ...lineup, [slotKey]: null };
    setLineup(newLineup);
    setActiveTeamColor(deriveTeamColor(newLineup, bench));
  }
  function handleRemoveBench(index) {
    const newBench = [...bench]; newBench[index] = null;
    setBench(newBench);
    setActiveTeamColor(deriveTeamColor(lineup, newBench));
  }
  function clearAll() {
    const empty = { PG: null, SG: null, SF: null, PF: null, C: null };
    setLineup(empty); setBench(Array(BENCH_SIZE).fill(null));
    setActiveTeamColor('#4ade80');
    setRatingDeltas(null);
    prevRatingsRef.current = null;
  }

  // ── Weighted team overall (defined before early returns so hooks below are safe) ─
  function calcWeightedTeamRating(players, key) {
    if (!players.length) return null;
    const sorted = [...players].sort((a, b) => (b.eff ?? 0) - (a.eff ?? 0));
    const weights = sorted.map((_, i) => i === 0 ? 5.0 : i === 1 ? 4.0 : i === 2 ? 3.0 : i <= 4 ? 2.0 : 1.0);
    const totalW = weights.reduce((s, w) => s + w, 0) || 1;
    return Math.round(sorted.reduce((s, p, i) => s + (p[key] ?? 0) * weights[i], 0) / totalW);
  }

  const allBuilderPlayers = [
    ...['PG', 'SG', 'SF', 'PF', 'C'].map(k => lineup[k]).filter(Boolean),
    ...bench.filter(Boolean),
  ];
  const builderTeamOvr    = calcWeightedTeamRating(allBuilderPlayers, 'eff');
  const CAT_SHORT_BUILDER = { playmaking: 'PM', shooting: 'SH', finishing: 'FN', rebounding: 'RB', interiorDef: 'ID', perimDef: 'PD' };

  // ── Subcategory → parent category map ──────────────────────────────────────
  const SUB_TO_CAT = {};
  for (const g of CATEGORY_GROUPS) for (const sub of g.subcategories) SUB_TO_CAT[sub.key] = g.key;

  // ── Chemistry summary ───────────────────────────────────────────────────────
  const chemPlayers = allBuilderPlayers
    .filter(p => CHEMISTRY_PROFILES[p.id])
    .map(p => {
      const profile = CHEMISTRY_PROFILES[p.id];
      const catDeltas = {};
      for (const [sub, delta] of Object.entries(profile)) {
        const cat = SUB_TO_CAT[sub];
        if (cat) catDeltas[cat] = (catDeltas[cat] || 0) + delta;
      }
      return { player: p, catDeltas };
    });

  const chemAggregate = {};
  for (const { catDeltas } of chemPlayers)
    for (const [cat, delta] of Object.entries(catDeltas))
      chemAggregate[cat] = (chemAggregate[cat] || 0) + delta;

  // ── Rating-change delta effect ──────────────────────────────────────────────
  const playerIdsKey = allBuilderPlayers.map(p => p.id).join(',');

  useEffect(() => {
    if (!allBuilderPlayers.length) { prevRatingsRef.current = null; setRatingDeltas(null); return; }
    const cats = Object.fromEntries(CATEGORY_GROUPS.map(g => [g.key, calcWeightedTeamRating(allBuilderPlayers, g.key) ?? 0]));
    const prev = prevRatingsRef.current;
    if (prev) {
      // Delta stays visible until the next roster change — no timeout
      setRatingDeltas({
        ovr: (builderTeamOvr ?? 0) - (prev.ovr ?? 0),
        cats: Object.fromEntries(CATEGORY_GROUPS.map(g => [g.key, (cats[g.key] ?? 0) - (prev.cats[g.key] ?? 0)])),
      });
    }
    prevRatingsRef.current = { ovr: builderTeamOvr, cats };
  }, [playerIdsKey]); // eslint-disable-line

  const slotDef = selectingSlot?.type === 'starter' ? SLOT_DEFS.find(s => s.key === selectingSlot.key) : null;
  const selectingLabel = selectingSlot?.type === 'bench' ? `Bench ${selectingSlot.index + 1}` : slotDef?.label ?? '';

  if (selectingSlot && swapMode) {
    return (
      <SwapPanel
        selectingSlot={selectingSlot} lineup={lineup} bench={bench}
        onSwap={handleSwap} onSearchAll={() => setSwapMode(false)}
        onClose={() => { setSelectingSlot(null); setSwapMode(false); }}
      />
    );
  }

  if (selectingSlot && !swapMode) {
    return (
      <PlayerSelect
        slotKey={selectingSlot.type === 'starter' ? selectingSlot.key : 'BENCH'}
        slotLabel={selectingLabel}
        takenIds={takenIds}
        onSelect={handlePlayerSelect}
        onClose={() => { setSelectingSlot(null); setSwapMode(false); }}
      />
    );
  }

  const filledStarterCount = Object.values(lineup).filter(Boolean).length;
  const filledBenchCount   = bench.filter(Boolean).length;
  const filledCount        = filledStarterCount + filledBenchCount;
  const allSlotsFilled     = filledStarterCount === 5 && filledBenchCount === BENCH_SIZE;

  const teamOptions = [
    { id: '__new__', name: '+ Create New Team' },
    ...Object.entries(NBA_TEAMS)
      .sort((a, b) => a[1].name.localeCompare(b[1].name))
      .map(([abbr, t]) => ({ id: abbr, name: `${t.name} (${abbr})` })),
    ...Object.entries(savedTeams).map(([name]) => ({ id: `custom_${name}`, name: `★ ${name}` })),
  ];

  const TABS = [
    { key: 'builder',    label: 'Team Builder' },
    { key: 'matchup',    label: 'Matchup' },
    { key: 'comparison', label: 'Player Comparison' },
  ];

  // Starters and bench for display
  const slotKeys = ['PG', 'SG', 'SF', 'PF', 'C'];
  const starterCards = slotKeys.map(k => ({ player: lineup[k], label: k, isBench: false }));
  const benchCards   = bench.map((player, i) => ({ player, label: `B${i + 1}`, isBench: true, index: i }));

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d', display: 'flex', flexDirection: 'column' }}>
      {/* ── Top nav ──────────────────────────────────────────────────────── */}
      <div className="nav-bar" style={{
        padding: '12px 20px 0', borderBottom: '1px solid #1a1a1a',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <h1 className="nav-title" style={{ fontSize: 17, fontWeight: 700, color: 'white', margin: 0, letterSpacing: '-0.02em' }}>FastBreak NBA</h1>
          <div className="nav-tabs-desktop" style={{ display: 'flex', gap: 0 }}>
            {TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                style={{
                  background: 'none', border: 'none',
                  borderBottom: activeTab === tab.key ? `2px solid ${activeTeamColor}` : '2px solid transparent',
                  color: activeTab === tab.key ? 'white' : '#555',
                  fontSize: 12, fontWeight: 600, padding: '6px 14px 10px', cursor: 'pointer',
                }}
              >{tab.label}</button>
            ))}
          </div>
        </div>

        {activeTab === 'builder' && (
          <div className="nav-builder-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10 }}>
            <select
              value=""
              onChange={e => e.target.value && loadTeam(e.target.value)}
              style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 8, color: '#aaa', fontSize: 11, padding: '6px 10px', cursor: 'pointer' }}
            >
              <option value="">Load team…</option>
              {teamOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>

            {showSaveInput ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  autoFocus value={saveNameInput} onChange={e => setSaveNameInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && allSlotsFilled && saveTeam()}
                  placeholder="Team name…"
                  style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 8, color: 'white', fontSize: 11, padding: '6px 10px', outline: 'none', width: 120 }}
                />
                <button onClick={saveTeam} disabled={!allSlotsFilled}
                  style={{ background: allSlotsFilled ? '#1a3a1a' : '#111', border: `1px solid ${allSlotsFilled ? '#2a5a2a' : '#1a1a1a'}`, borderRadius: 8, color: allSlotsFilled ? '#4ade80' : '#333', fontSize: 11, padding: '6px 10px', cursor: allSlotsFilled ? 'pointer' : 'default' }}>
                  Save
                </button>
                <button onClick={() => setShowSaveInput(false)} style={{ background: 'none', border: '1px solid #2a2a2a', borderRadius: 8, color: '#555', fontSize: 11, padding: '6px 10px', cursor: 'pointer' }}>✕</button>
              </div>
            ) : (
              <button onClick={() => setShowSaveInput(true)} disabled={filledCount === 0}
                style={{ background: 'none', border: '1px solid #2a2a2a', borderRadius: 8, color: filledCount > 0 ? '#888' : '#333', fontSize: 11, padding: '6px 12px', cursor: filledCount > 0 ? 'pointer' : 'default' }}
                title={!allSlotsFilled ? 'Fill all 10 slots to save' : undefined}
              >
                Save team
              </button>
            )}
            {!allSlotsFilled && filledCount > 0 && showSaveInput && (
              <span style={{ fontSize: 9, color: '#555' }}>{10 - filledCount} slot{10 - filledCount !== 1 ? 's' : ''} remaining</span>
            )}
            {filledCount > 0 && (
              <button onClick={clearAll} style={{ background: 'none', border: '1px solid #2a2a2a', borderRadius: 8, color: '#555', fontSize: 11, padding: '6px 12px', cursor: 'pointer' }}>Clear</button>
            )}
          </div>
        )}
      </div>

      {/* ── Tab content ────────────────────────────────────────────────────── */}
      {activeTab === 'builder' && (
        <>
          {/* Mobile builder toolbar — load/save, hidden on desktop */}
          <div className="mobile-builder-toolbar tab-content">
            <select
              value=""
              onChange={e => e.target.value && loadTeam(e.target.value)}
              style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 8, color: '#aaa', fontSize: 13, padding: '7px 10px', cursor: 'pointer', flex: 1 }}
            >
              <option value="">Load team…</option>
              {teamOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {filledCount > 0 && (
              <button onClick={clearAll} style={{ background: 'none', border: '1px solid #2a2a2a', borderRadius: 8, color: '#555', fontSize: 12, padding: '7px 12px', cursor: 'pointer', flexShrink: 0 }}>Clear</button>
            )}
          </div>

          {/* Team overall ratings bar */}
          {builderTeamOvr !== null && (
            <div style={{ flexShrink: 0, background: '#0a0a0a', borderBottom: '1px solid #1a1a1a' }}>
              {/* Row 1 — OVR + categories */}
              <div className="team-ovr-bar" style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '10px 24px' }}>
                {/* Team overall */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, position: 'relative' }}>
                  <span style={{ fontSize: 10, color: '#444', fontWeight: 700, letterSpacing: '0.08em' }}>TEAM OVR</span>
                  <span style={{ fontSize: 30, color: activeTeamColor, fontWeight: 900, lineHeight: 1 }}>
                    {builderTeamOvr}
                  </span>
                  {/* Arrow indicator */}
                  {ratingDeltas && ratingDeltas.ovr !== 0 && (
                    <span style={{
                      fontSize: 13, fontWeight: 900, lineHeight: 1,
                      color: ratingDeltas.ovr > 0 ? '#4ade80' : '#f87171',
                      marginLeft: 2,
                    }}>
                      {ratingDeltas.ovr > 0 ? '▲' : '▼'}
                    </span>
                  )}
                </div>
                <div style={{ width: 1, height: 30, background: '#1a1a1a' }} />
                {/* Category ratings */}
                <div className="team-ovr-categories" style={{ display: 'flex', gap: 20 }}>
                  {CATEGORY_GROUPS.map(g => {
                    const val = calcWeightedTeamRating(allBuilderPlayers, g.key) ?? null;
                    const delta = ratingDeltas?.cats?.[g.key] ?? 0;
                    const numColor = delta > 0 ? '#4ade80' : delta < 0 ? '#f87171' : 'white';
                    return (
                      <div key={g.key} style={{ textAlign: 'center', minWidth: 28 }}>
                        <div style={{ fontSize: 8, color: g.color, fontWeight: 700, letterSpacing: '0.04em' }}>{CAT_SHORT_BUILDER[g.key]}</div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: numColor, transition: 'color 0.3s', position: 'relative', display: 'inline-block' }}>
                          {val ?? '—'}
                          {delta !== 0 && (
                            <span style={{
                              position: 'absolute', top: -6, right: -14,
                              fontSize: 9, fontWeight: 700,
                              color: delta > 0 ? '#4ade80' : '#f87171',
                              lineHeight: 1,
                            }}>
                              {delta > 0 ? `+${delta}` : delta}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {!allSlotsFilled && filledCount > 0 && (
                  <div style={{ marginLeft: 'auto', fontSize: 9, color: '#333' }}>
                    {10 - filledCount} slot{10 - filledCount !== 1 ? 's' : ''} open
                  </div>
                )}
              </div>

              {/* Row 2 — Chemistry panel (only when chemistry players are present) */}
              {chemPlayers.length > 0 && (
                <div style={{ padding: '6px 24px 10px', borderTop: '1px solid #141414' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingTop: 1, flexShrink: 0 }}>
                      <span style={{ fontSize: 8, color: '#555', fontWeight: 700, letterSpacing: '0.1em' }}>CHEMISTRY</span>
                      {/* Aggregate net badge */}
                      {Object.values(chemAggregate).some(v => v !== 0) && (
                        <span style={{
                          fontSize: 8, padding: '1px 5px', borderRadius: 4, fontWeight: 700,
                          background: Object.values(chemAggregate).reduce((s, v) => s + v, 0) >= 0 ? '#0d2a1a' : '#2a0d0d',
                          color:      Object.values(chemAggregate).reduce((s, v) => s + v, 0) >= 0 ? '#4ade80' : '#f87171',
                          border: `1px solid ${Object.values(chemAggregate).reduce((s, v) => s + v, 0) >= 0 ? '#4ade8033' : '#f8717133'}`,
                        }}>
                          {Object.values(chemAggregate).reduce((s, v) => s + v, 0) > 0
                            ? `+${Object.values(chemAggregate).reduce((s, v) => s + v, 0)}`
                            : Object.values(chemAggregate).reduce((s, v) => s + v, 0)} net
                        </span>
                      )}
                    </div>

                    {/* Per-player chemistry rows */}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', flex: 1 }}>
                      {chemPlayers.map(({ player, catDeltas }) => {
                        const netSum = Object.values(catDeltas).reduce((s, v) => s + v, 0);
                        const borderClr = netSum > 0 ? '#4ade8028' : netSum < 0 ? '#f8717128' : '#2a2a2a';
                        const labelClr  = netSum > 0 ? '#4ade8099' : netSum < 0 ? '#f8717199' : '#555';
                        return (
                          <div key={player.id} style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            background: '#111', border: `1px solid ${borderClr}`,
                            borderRadius: 6, padding: '4px 8px',
                          }}>
                            {/* Name + label */}
                            <div>
                              <span style={{ fontSize: 9, color: 'white', fontWeight: 700 }}>
                                {lastName(player.name).toUpperCase()}
                              </span>
                              <span style={{ fontSize: 8, color: '#444', marginLeft: 5 }}>
                                {getChemistryLabel(player.id).split('·')[0].trim()}
                              </span>
                            </div>
                            {/* Category impact badges */}
                            <div style={{ display: 'flex', gap: 3 }}>
                              {CATEGORY_GROUPS.map(g => {
                                const d = catDeltas[g.key];
                                if (!d) return null;
                                return (
                                  <span key={g.key} style={{
                                    fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
                                    background: d > 0 ? '#0d2a1a' : '#2a0d0d',
                                    color: d > 0 ? '#4ade80' : '#f87171',
                                    border: `1px solid ${d > 0 ? '#4ade8022' : '#f8717122'}`,
                                  }}>
                                    {CAT_SHORT_BUILDER[g.key]}{d > 0 ? `+${d}` : d}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Aggregate category row */}
                  {Object.keys(chemAggregate).length > 0 && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 7, color: '#333', fontWeight: 700, letterSpacing: '0.08em', flexShrink: 0 }}>NET EFFECT</span>
                      {CATEGORY_GROUPS.map(g => {
                        const d = chemAggregate[g.key];
                        if (!d) return null;
                        return (
                          <div key={g.key} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <span style={{ fontSize: 8, color: g.color, fontWeight: 700 }}>{CAT_SHORT_BUILDER[g.key]}</span>
                            <span style={{
                              fontSize: 9, fontWeight: 800,
                              color: d > 0 ? '#4ade80' : '#f87171',
                            }}>
                              {d > 0 ? `+${d}` : d}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Category legend */}
          <div className="legend-bar" style={{
            flexShrink: 0, display: 'flex', gap: 14, flexWrap: 'wrap',
            padding: '7px 24px', background: '#0a0a0a', borderBottom: '1px solid #141414',
          }}>
            {CATEGORY_GROUPS.map(g => (
              <span key={g.key} style={{ fontSize: 9, color: g.color, fontWeight: 700 }}>
                ▬ {g.label}
              </span>
            ))}
          </div>

          {/* Court + Bench column */}
          <div className="builder-layout" style={{ flexShrink: 0, display: 'flex', alignItems: 'stretch', gap: 0 }}>
            {/* Court */}
            <div className="court-wrapper" style={{ flex: 1, minWidth: 0 }}>
              <Court lineup={lineup} onSlotClick={handleStarterSlotClick} color={activeTeamColor} />
            </div>
            {/* Bench column — desktop: vertical sidebar, mobile: hidden here (shown below) */}
            <div className="bench-sidebar-desktop" style={{
              display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 14px',
              justifyContent: 'center', background: '#0a0a0a', borderLeft: '1px solid #141414',
              minWidth: 80,
            }}>
              <div style={{ fontSize: 7, color: '#333', fontWeight: 700, letterSpacing: '0.08em', textAlign: 'center', marginBottom: 2 }}>BENCH</div>
              {bench.map((player, i) => (
                <BenchCircle
                  key={i}
                  player={player}
                  index={i}
                  teamColor={activeTeamColor}
                  onClick={() => handleBenchSlotClick(i)}
                />
              ))}
            </div>
          </div>

          {/* Bench row — mobile only horizontal scroll */}
          <div className="bench-panel-mobile" style={{ display: 'none' }}>
            <div style={{ fontSize: 7, color: '#333', fontWeight: 700, letterSpacing: '0.08em', alignSelf: 'center', marginRight: 4 }}>BENCH</div>
            {bench.map((player, i) => (
              <div key={i} className="bench-slot-mobile">
                <BenchCircle
                  player={player}
                  index={i}
                  teamColor={activeTeamColor}
                  onClick={() => handleBenchSlotClick(i)}
                />
              </div>
            ))}
          </div>

          {/* Big player cards — starters + bench */}
          <div className="player-cards-section" style={{ flexShrink: 0, padding: '12px 16px', borderBottom: '1px solid #1a1a1a', overflowX: 'auto' }}>
            <div style={{ display: 'flex', gap: 8, minWidth: 'max-content' }}>
              {/* Starter cards */}
              {starterCards.map(({ player, label }) =>
                player ? (
                  <BigPlayerCard key={player.id} player={player} slotLabel={label} isBench={false} teamColor={activeTeamColor} onClick={() => setCardOverlayPlayer(player)} />
                ) : (
                  <div key={label}
                    onClick={() => handleStarterSlotClick(label)}
                    style={{
                      width: 120, background: '#0d0d0d', border: `1px dashed ${activeTeamColor}22`, borderRadius: 12,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      padding: '10px', cursor: 'pointer', flexShrink: 0, gap: 4, minHeight: 160,
                    }}>
                    <span style={{ fontSize: 18, color: activeTeamColor + '33' }}>+</span>
                    <span style={{ fontSize: 10, color: activeTeamColor + '44', fontWeight: 700 }}>{label}</span>
                  </div>
                )
              )}

              {/* Divider */}
              <div style={{ width: 1, background: '#1a1a1a', alignSelf: 'stretch', flexShrink: 0, margin: '0 4px' }} />

              {/* Bench cards */}
              {benchCards.map(({ player, label, index }) =>
                player ? (
                  <BigPlayerCard key={player.id} player={player} slotLabel={label} isBench={true} teamColor={activeTeamColor} onClick={() => setCardOverlayPlayer(player)} />
                ) : (
                  <div key={label}
                    onClick={() => handleBenchSlotClick(index)}
                    style={{
                      width: 120, background: '#0d0d0d', border: `1px dashed ${activeTeamColor}15`, borderRadius: 12,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      padding: '10px', cursor: 'pointer', flexShrink: 0, gap: 4, minHeight: 160, opacity: 0.6,
                    }}>
                    <span style={{ fontSize: 18, color: activeTeamColor + '22' }}>+</span>
                    <span style={{ fontSize: 9, color: activeTeamColor + '33', fontWeight: 700 }}>{label}</span>
                  </div>
                )
              )}
            </div>
          </div>

          {cardOverlayPlayer && (
            <PlayerCardOverlay player={cardOverlayPlayer} onClose={() => setCardOverlayPlayer(null)} />
          )}
        </>
      )}

      {activeTab === 'matchup' && (
        <div className="tab-content" style={{ flex: 1, overflowY: 'auto' }}>
          <MatchupTab savedTeams={savedTeams} />
        </div>
      )}

      {activeTab === 'comparison' && (
        <div className="tab-content" style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
          <PlayerComparisonTab />
        </div>
      )}

      {/* ── Bottom nav (mobile only) ──────────────────────────────────────── */}
      <nav className="bottom-nav">
        {[
          { key: 'builder',    label: 'Builder'  },
          { key: 'matchup',    label: 'Matchup'  },
          { key: 'comparison', label: 'Compare'  },
        ].map(tab => (
          <button key={tab.key} className="bottom-nav-btn" onClick={() => setActiveTab(tab.key)}>
            <span className="bottom-nav-label" style={{ color: activeTab === tab.key ? activeTeamColor : '#555' }}>
              {tab.label}
            </span>
            {activeTab === tab.key && (
              <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 24, height: 2, background: activeTeamColor, borderRadius: 1 }} />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
