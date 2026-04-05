import React, { useState } from 'react';
import { SLOT_DEFS } from './Court';
import { ALL_PLAYERS, getPlayerById } from '../data/normalizedPlayers';
import { NBA_TEAMS } from '../data/teams';
import { CATEGORY_GROUPS, calcEffectiveness, deriveParentScores, calcSimulationWeights, lastName } from '../utils/metrics';
import { applyChemistry } from '../utils/chemistry';
import { getTeamColor } from '../data/teamColors';

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

// ── NBA Simulation Engine — Final Spec Implementation ────────────────────────
function randn(mean = 0, sd = 1) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function lognorm(mean = 0, sd = 0.3) { return Math.exp(randn(mean, sd)); }
function binomialDraw(n, p) { let made = 0; for (let i = 0; i < n; i++) if (Math.random() < p) made++; return made; }
function poissonDraw(lambda) {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda); let k = 0, p = 1.0;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}
function clamp(val, lo, hi) { return Math.max(lo, Math.min(hi, val)); }

function simulateGame(lineup1, bench1, lineup2, bench2) {
  const SLOT_KEYS = ['PG', 'SG', 'SF', 'PF', 'C'];

  function buildTeamEntries(lineup, bench) {
    const entries = [];
    SLOT_KEYS.forEach(k => {
      const p = lineup[k]; if (!p) return;
      const eff = p.eff ?? 75;
      const effShift = (eff - 75) / 33 * 5;
      const baseMins = (p.min && p.min > 0) ? clamp(p.min, 26, 40) : 30 + effShift;
      const target = clamp(baseMins + effShift, 26, 40);
      entries.push({ player: p, mins: clamp(randn(target, 2.5), 24, 42), isBench: false, slot: k });
    });
    // Active bench count scales with roster depth
    const benchPool = bench.filter(Boolean);
    const sorted = [...benchPool].sort((a, b) => ((b.eff ?? 65) + randn(0, 2.5)) - ((a.eff ?? 65) + randn(0, 2.5)));
    const avgBenchEff = benchPool.length > 0
      ? benchPool.reduce((s, p) => s + (p.eff ?? 65), 0) / benchPool.length : 65;
    // Deeper teams rotate more: avg bench EFF ≥75 → 6-7 active; <68 → 4-5
    const baseActive  = avgBenchEff >= 75 ? 6 : avgBenchEff >= 71 ? 5 : 4;
    const activeCount = Math.min(benchPool.length, baseActive + (Math.random() < 0.35 ? 1 : 0));
    const activeBench = new Set(sorted.slice(0, activeCount).map(p => p.id ?? p.name));

    benchPool.forEach(p => {
      if (!activeBench.has(p.id ?? p.name)) {
        entries.push({ player: p, mins: 0, isBench: true, slot: p.pos || 'BN', dnp: true });
        return;
      }
      const eff = p.eff ?? 65;
      const effShift = (eff - 65) / 33 * 4;
      const baseMins = (p.min && p.min > 0) ? clamp(p.min, 6, 28) : 15 + effShift;
      entries.push({ player: p, mins: clamp(randn(clamp(baseMins + effShift, 6, 26), 2.0), 4, 28), isBench: true, slot: p.pos || 'BN' });
    });
    const starters = entries.filter(e => !e.isBench && e.mins > 0);
    const benchP = entries.filter(e => e.isBench && e.mins > 0);
    const minStart = starters.length > 0 ? Math.min(...starters.map(e => e.mins)) : 24;
    benchP.forEach(e => { if (e.mins >= minStart) e.mins = Math.max(4, minStart - 1); });
    const active = entries.filter(e => e.mins > 0);
    const rawT = active.reduce((s, e) => s + e.mins, 0);
    if (rawT > 0) {
      const scale = 240 / rawT;
      active.forEach(e => { e.mins = e.mins * scale; });
      active.forEach(e => { e._frac = e.mins - Math.floor(e.mins); e.mins = Math.floor(e.mins); });
      let rem = 240 - active.reduce((s, e) => s + e.mins, 0);
      active.sort((a, b) => b._frac - a._frac);
      for (let i = 0; rem > 0; i++, rem--) active[i % active.length].mins += 1;
      active.forEach(e => { delete e._frac; });
    }
    return entries;
  }

  const entries1 = buildTeamEntries(lineup1, bench1);
  const entries2 = buildTeamEntries(lineup2, bench2);

  function teamRating(entries) {
    if (entries.length === 0) return { off: 50, def: 50, reb: 50 };
    let wOff = 0, wDef = 0, wReb = 0, wTotal = 0;
    entries.forEach(e => {
      if (e.mins <= 0) return;
      const p = e.player;
      const qualMult = e.isBench ? 0.82 : 1.0;
      const minWt = e.mins / 48;
      const offW = ((p.playmaking ?? 50) * 0.32 + (p.shooting ?? 50) * 0.38 + (p.finishing ?? 50) * 0.30) + (lognorm(0, 0.12) - 1.0) * 50;
      const defW = (p.interiorDef ?? 50) * 0.55 + (p.perimDef ?? 50) * 0.45;
      wOff += offW * minWt * qualMult; wDef += defW * minWt * qualMult;
      wReb += (p.rebounding ?? 50) * minWt * qualMult; wTotal += minWt;
    });
    if (wTotal === 0) return { off: 50, def: 50, reb: 50 };
    return { off: wOff / wTotal, def: wDef / wTotal, reb: wReb / wTotal };
  }

  const r1 = teamRating(entries1), r2 = teamRating(entries2);

  function calcTeamScore(teamOff, oppDef, teamReb) {
    const qualityDiff = teamOff - oppDef;
    const blowout = Math.random() < 0.18;
    const diffMult = clamp(blowout ? randn(1.7, 0.3) : randn(1.0, 0.15), 0.4, 2.5);
    return clamp(Math.round(116 + qualityDiff * 0.30 * diffMult + teamReb * 0.05 + randn(0, 11)), 88, 148);
  }

  let score1 = calcTeamScore(r1.off, r2.def, r1.reb);
  let score2 = calcTeamScore(r2.off, r1.def, r2.reb);
  if (score1 === score2) { const g = Math.floor(Math.random() * 3) + 1; if (r1.off >= r2.off) score1 += g; else score2 += g; }

  let isOvertime = false;
  const addOT = () => { score1 += Math.max(0, Math.round(randn(10, 3))); score2 += Math.max(0, Math.round(randn(10, 3))); };
  if (Math.abs(score1 - score2) <= 4 && Math.random() < 0.30) {
    addOT(); isOvertime = true;
    if (score1 === score2) { if (Math.random() < 0.17) addOT(); else { if (r1.off >= r2.off) score1 += 2; else score2 += 2; } }
  }
  if (score1 === score2) { if (r1.off >= r2.off) score1 += 1; else score2 += 1; }


  // ── Player-driven box score generation ────────────────────────────────────
  // FG makes are generated first from position/attribute-based attempt rates,
  // then pts = 2*fg2m + 3*fg3m + ftm. FT is distributed last to hit the team
  // target, so point totals are always consistent with the shot line.
  function generateBoxScores(entries, teamScore, oppDef) {
    const active = entries.filter(e => e.mins > 0);
    if (active.length === 0) return entries;

    const oppImpact = clamp((oppDef - 50) / 99 * 0.03, -0.02, 0.03);

    const raw = active.map(e => {
      const p = e.player;
      const { mins } = e;
      const pos = p.pos || 'SF';
      const isGuard = ['PG', 'SG'].includes(pos);
      const isBig   = ['PF', 'C'].includes(pos);
      const mf = mins / 36;
      const bm = e.isBench ? 0.82 : 1.0;

      const sh   = p.shooting    ?? 50;
      const fin  = p.finishing   ?? 50;
      const pm   = p.playmaking  ?? 50;
      const reb  = p.rebounding  ?? 50;
      const iDef = p.interiorDef ?? 50;
      const pDef = p.perimDef    ?? 50;

      // 3PT attempts — guards shoot far more threes than bigs
      const base3 = isGuard ? 3.5 + (sh / 99) * 3.0
                  : isBig   ? 0.6 + (sh / 99) * 2.0
                  :           2.0 + (sh / 99) * 2.5;
      const fg3a = Math.max(0, Math.round(base3 * mf * bm * lognorm(0, 0.22)));

      // 2PT attempts — bigs get to the paint more often
      const base2 = isGuard ? 5.0 + (fin / 99) * 2.5
                  : isBig   ? 6.5 + (fin / 99) * 3.5
                  :           5.5 + (fin / 99) * 3.0;
      const fg2a = Math.max(0, Math.round(base2 * mf * bm * lognorm(0, 0.22)));

      // FG% — hot/cold variance applied once per player
      const hotRoll = Math.random();
      const hotMod  = hotRoll < 0.10 ? -0.06 : hotRoll > 0.90 ? +0.06 : 0;
      const fg3pct  = clamp(0.28 + (sh / 99) * 0.16 - oppImpact + randn(0, 0.04) + hotMod, 0.20, 0.56);
      const fg2pct  = clamp(0.42 + (fin / 99) * 0.12 + (sh / 99) * 0.03 - oppImpact + randn(0, 0.04) + hotMod, 0.30, 0.68);

      const fg3m  = binomialDraw(fg3a, fg3pct);
      const fg2m  = binomialDraw(fg2a, fg2pct);
      const fgPts = 2 * fg2m + 3 * fg3m;

      // Rebounds — threshold model: low-reb guards get 1-2, elite bigs get 10-12
      // Base only applies if attribute clears a minimum bar
      const rebBase  = isBig ? 4.5 : isGuard ? 0.5 : 2.0;
      const rebScale = isBig ? 8.0 : isGuard ? 3.5 : 5.0;
      const rebLambda = (rebBase + Math.max(0, reb - 40) / 59 * rebScale) * mf * bm;
      const totalReb = Math.min(22, poissonDraw(rebLambda));
      const offReb   = Math.round(totalReb * (isBig ? 0.27 : isGuard ? 0.15 : 0.20));
      const defReb   = totalReb - offReb;

      // Assists — only genuine playmakers generate assists; threshold at pm=42
      // pg pm=75 → ~6 ast  |  scoring guard pm=55 → ~2 ast  |  big pm=40 → 0 ast
      const astScale  = isGuard ? 13.0 : isBig ? 4.5 : 8.0;
      const astLambda = Math.max(0, (pm - 42) / 57) * astScale * mf * bm;
      const ast = Math.min(16, poissonDraw(astLambda));

      // Steals — threshold at pDef=45; only lockdown defenders average 1+/game
      const stlScale  = isGuard ? 2.8 : isBig ? 0.7 : 1.8;
      const stlLambda = Math.max(0, (pDef - 45) / 54) * stlScale * mf;
      const stl = Math.min(4, poissonDraw(stlLambda));

      // Blocks — threshold at iDef=50 for bigs, nearly zero for everyone else
      const maxBlk    = isBig ? 6 : pos === 'SF' ? 2 : 1;
      const blkScale  = isBig ? 3.5 : pos === 'SF' ? 0.8 : 0.15;
      const blkThresh = isBig ? 45 : pos === 'SF' ? 55 : 65; // guards need very high iDef
      const blkLambda = Math.max(0, (iDef - blkThresh) / 54) * blkScale * mf;
      const blk = Math.min(maxBlk, poissonDraw(blkLambda));

      // Turnovers — high-usage playmakers turn it over more
      const tov = Math.max(0, Math.min(9,
        Math.round(((isGuard ? 1.8 : isBig ? 1.0 : 1.3) + (pm / 99) * 1.5) * mf * bm * lognorm(0, 0.36))));

      const pf = Math.min(6, Math.max(0, Math.round(2.0 * mf * lognorm(0, 0.28))));

      // FT usage weight for distribution: finishing-heavy and high-usage earners get more FTAs
      const ftUsageW = (fin / 99) * 0.55 + (e.isBench ? 0.1 : 0.45);

      return { ...e, fg2m, fg2a, fg3m, fg3a, fgPts, totalReb, offReb, defReb, ast, stl, blk, tov, pf, ftUsageW };
    });

    // FT distribution: bridge FG pts up to team score target
    const totalFGPts = raw.reduce((s, e) => s + e.fgPts, 0);
    const targetFTM  = Math.max(0, teamScore - totalFGPts);
    const totalFTW   = raw.reduce((s, e) => s + e.ftUsageW, 0) || 1;

    let remaining = targetFTM;
    const ftAssigned = raw.map((e, i) => {
      if (i === raw.length - 1) return Math.max(0, remaining);
      const share = Math.round(targetFTM * (e.ftUsageW / totalFTW));
      remaining -= share;
      return Math.max(0, share);
    });

    const result = raw.map((e, i) => {
      const ftm = ftAssigned[i];
      const ftPct = clamp(0.65 + ((e.player.shooting ?? 50) / 99) * 0.20, 0.50, 0.99);
      const fta = Math.round(ftm / Math.max(ftPct, 0.50));
      const fgm = e.fg2m + e.fg3m;
      const fga = e.fg2a + e.fg3a;
      const pts = e.fgPts + ftm;  // always consistent: pts = 2*fg2m + 3*fg3m + ftm
      const { fgPts: _fp, ftUsageW: _fw, totalReb: _tr, ...rest } = e;
      return { ...rest, pts, fgm, fga, fg3m: e.fg3m, fg3a: e.fg3a, ftm, fta,
        reb: e.totalReb, offReb: e.offReb, defReb: e.defReb };
    });

    const resultMap = new Map(result.map(e => [e.player.id ?? e.player.name, e]));
    const blank = { pts: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0,
      reb: 0, offReb: 0, defReb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 };
    return entries.map(e => resultMap.get(e.player.id ?? e.player.name) ?? { ...e, ...blank });
  }

  const shots1 = generateBoxScores(entries1, score1, r2.def);
  const shots2 = generateBoxScores(entries2, score2, r1.def);

  function applyPlusMinus(shotsEntries, teamMargin, oppEntries) {
    const oppAvgEff = oppEntries.filter(e => e.mins > 0).length > 0
      ? oppEntries.filter(e => e.mins > 0).reduce((s, e) => s + (e.player.eff ?? 75), 0) / oppEntries.filter(e => e.mins > 0).length : 75;
    return shotsEntries.map(e => {
      if (e.mins === 0) return { ...e, plusMinus: 0 };
      const pm = clamp(Math.round(teamMargin * (e.mins / 48) * 0.60 * 0.55 + ((e.player.eff ?? 75) - oppAvgEff) / 99 * 10 * 0.25 + randn(0, e.isBench ? 7.0 : 4.5)), -28, 32);
      return { ...e, plusMinus: pm };
    });
  }

  return {
    score1, score2,
    boxScores1: applyPlusMinus(shots1, score1 - score2, entries2),
    boxScores2: applyPlusMinus(shots2, score2 - score1, entries1),
    isOvertime,
  };
}

// ── Box Score table ────────────────────────────────────────────────────────────
function BoxScoreTable({ boxScores, color, teamName }) {
  if (!boxScores || boxScores.length === 0) return null;
  const starters  = boxScores.filter(r => !r.isBench);
  const activeBench = boxScores.filter(r => r.isBench && !r.dnp);
  const dnpBench    = boxScores.filter(r => r.isBench && r.dnp);
  const activePlayers = [...starters, ...activeBench];
  const totals = activePlayers.reduce((acc, r) => ({
    pts: acc.pts + r.pts, fgm: acc.fgm + r.fgm, fga: acc.fga + r.fga,
    fg3m: acc.fg3m + r.fg3m, fg3a: acc.fg3a + r.fg3a,
    ftm: acc.ftm + r.ftm, fta: acc.fta + r.fta,
    reb: acc.reb + r.reb, ast: acc.ast + r.ast, stl: acc.stl + r.stl, blk: acc.blk + r.blk,
    plusMinus: 0,
  }), { pts:0, fgm:0, fga:0, fg3m:0, fg3a:0, ftm:0, fta:0, reb:0, ast:0, stl:0, blk:0, plusMinus:0 });

  const colStyle = (isNum = true) => ({ padding: '4px 6px', fontSize: 10, color: isNum ? '#888' : '#ccc', textAlign: isNum ? 'right' : 'left', borderBottom: '1px solid #141414', whiteSpace: 'nowrap' });
  const hCol = (label) => <th style={{ padding: '4px 6px', fontSize: 9, color: color, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700, letterSpacing: '0.04em', borderBottom: `1px solid ${color}44` }}>{label}</th>;
  const renderRow = (r, i) => (
    <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : '#0d0d0d' }}>
      <td style={{ ...colStyle(false), paddingLeft: r.isBench ? 20 : 8 }}>
        <div style={{ fontSize: 9, color: '#555' }}>{r.player.name.split(' ')[0]}</div>
        <div style={{ fontWeight: 700 }}>{lastName(r.player.name)}</div>
      </td>
      <td style={colStyle()}>{r.isBench ? (r.player.pos || r.slot) : r.slot}</td>
      <td style={colStyle()}>{r.mins}</td>
      <td style={{ ...colStyle(), fontWeight: 700, color: 'white' }}>{r.pts}</td>
      <td style={colStyle()}>{r.fgm}-{r.fga}</td>
      <td style={colStyle()}>{r.fg3m}-{r.fg3a}</td>
      <td style={colStyle()}>{r.ftm}-{r.fta}</td>
      <td style={colStyle()}>{r.reb}</td>
      <td style={colStyle()}>{r.ast}</td>
      <td style={colStyle()}>{r.stl}</td>
      <td style={colStyle()}>{r.blk}</td>
      <td style={{ ...colStyle(), color: r.plusMinus > 0 ? '#4ade80' : r.plusMinus < 0 ? '#f87171' : '#555', fontWeight: 600 }}>
        {r.plusMinus > 0 ? `+${r.plusMinus}` : r.plusMinus}
      </td>
    </tr>
  );

  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ fontSize: 9, color: color, fontWeight: 700, letterSpacing: '0.08em', margin: '0 0 6px', textTransform: 'uppercase' }}>{teamName}</p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
          <thead>
            <tr>
              <th style={{ padding: '4px 8px', fontSize: 9, color: '#444', textAlign: 'left', borderBottom: `1px solid ${color}44`, minWidth: 100 }}>PLAYER</th>
              {hCol('POS')} {hCol('MIN')} {hCol('PTS')} {hCol('FG')} {hCol('3P')} {hCol('FT')} {hCol('REB')} {hCol('AST')} {hCol('STL')} {hCol('BLK')} {hCol('+/-')}
            </tr>
          </thead>
          <tbody>
            {starters.map(renderRow)}
            {(activeBench.length > 0 || dnpBench.length > 0) && <tr><td colSpan={12} style={{ padding: '3px 8px', fontSize: 8, color: '#333', fontWeight: 700, letterSpacing: '0.06em', background: '#0a0a0a', borderBottom: '1px solid #1a1a1a' }}>BENCH</td></tr>}
            {activeBench.map(renderRow)}
            {dnpBench.length > 0 && dnpBench.map((r, i) => (
              <tr key={'dnp-' + i} style={{ background: i % 2 === 0 ? 'transparent' : '#0d0d0d', opacity: 0.45 }}>
                <td style={{ padding: '4px 8px 4px 20px', fontSize: 10, color: '#555' }}>
                  <div style={{ fontSize: 9, color: '#444' }}>{r.player.name.split(' ')[0]}</div>
                  <div style={{ fontWeight: 700, color: '#555' }}>{lastName(r.player.name)}</div>
                </td>
                <td style={{ padding: '4px 6px', fontSize: 10, color: '#444', textAlign: 'right' }}>{r.player.pos || r.slot}</td>
                <td colSpan={10} style={{ padding: '4px 6px', fontSize: 9, color: '#444', fontStyle: 'italic', letterSpacing: '0.04em' }}>DNP</td>
              </tr>
            ))}
            <tr style={{ background: '#111', borderTop: `1px solid ${color}33` }}>
              <td style={{ ...colStyle(false), fontWeight: 700, color: color }}>TOTALS</td>
              <td colSpan={2} style={colStyle()} />
              <td style={{ ...colStyle(), fontWeight: 800, fontSize: 12, color: 'white' }}>{totals.pts}</td>
              <td style={colStyle()}>{totals.fgm}-{totals.fga}</td>
              <td style={colStyle()}>{totals.fg3m}-{totals.fg3a}</td>
              <td style={colStyle()}>{totals.ftm}-{totals.fta}</td>
              <td style={{ ...colStyle(), color: '#ccc' }}>{totals.reb}</td>
              <td style={{ ...colStyle(), color: '#ccc' }}>{totals.ast}</td>
              <td style={{ ...colStyle(), color: '#ccc' }}>{totals.stl}</td>
              <td style={{ ...colStyle(), color: '#ccc' }}>{totals.blk}</td>
              <td style={colStyle()} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Weighted team rating helper ────────────────────────────────────────────────
function calcWeightedTeamRating(players, key) {
  if (!players.length) return 0;
  const sorted = [...players].sort((a, b) => (b.eff ?? 0) - (a.eff ?? 0));
  const weights = sorted.map((_, i) => i === 0 ? 5.0 : i === 1 ? 4.0 : i === 2 ? 3.0 : i <= 4 ? 2.0 : 1.0);
  const totalW = weights.reduce((s, w) => s + w, 0) || 1;
  return Math.round(sorted.reduce((s, p, i) => s + (p[key] ?? 0) * weights[i], 0) / totalW);
}

// ── Full player detail overlay ────────────────────────────────────────────────
function PlayerDetailOverlay({ player, color, onClose }) {
  const [expanded, setExpanded] = useState({});
  const toggleCat = key => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#111', border: `1px solid ${color}44`, borderRadius: 14, width: '100%', maxWidth: 420, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px 10px', borderBottom: '1px solid #1e1e1e', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 9, color: color, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 2 }}>{player.team} · {player.pos}</div>
            <div style={{ fontSize: 10, color: '#888' }}>{player.name.split(' ')[0]}</div>
            <div style={{ fontSize: 18, color: 'white', fontWeight: 800, lineHeight: 1 }}>{lastName(player.name)}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 32, color: color, fontWeight: 900, lineHeight: 1 }}>{player.eff}</div>
              <div style={{ fontSize: 8, color: '#444', fontWeight: 700, letterSpacing: '0.06em' }}>EFF</div>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: '1px solid #2a2a2a', borderRadius: 6, color: '#555', fontSize: 14, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >✕</button>
          </div>
        </div>

        {/* Category bars */}
        <div style={{ overflowY: 'auto', padding: '12px 16px 16px' }}>
          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginBottom: 10 }}>
            {CATEGORY_GROUPS.map(g => (
              <span key={g.key} style={{ fontSize: 8, color: g.color, fontWeight: 600 }}>{CAT_SHORT[g.key]} = {g.label}</span>
            ))}
            <span style={{ fontSize: 8, color: '#333' }}>· tap category to expand</span>
          </div>

          {CATEGORY_GROUPS.map(g => {
            const val = player[g.key] ?? 0;
            const isExp = !!expanded[g.key];
            return (
              <div key={g.key}>
                {/* Category row */}
                <div
                  onClick={() => toggleCat(g.key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '4px 0', userSelect: 'none' }}
                >
                  <span style={{ fontSize: 9, color: g.color, fontWeight: 700, width: 22, flexShrink: 0 }}>{CAT_SHORT[g.key]}</span>
                  <div style={{ flex: 1, height: 6, background: '#1e1e1e', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.round(val * 0.9)}%`, background: g.color, borderRadius: 3, opacity: 0.85 }} />
                  </div>
                  <span style={{ fontSize: 10, color: g.color, width: 28, textAlign: 'right', fontWeight: 700 }}>{val}</span>
                  <span style={{ fontSize: 8, color: '#333', width: 8 }}>{isExp ? '▲' : '▼'}</span>
                </div>
                {/* Subcategory rows */}
                {isExp && g.subcategories.map(sub => {
                  const sv = player[sub.key] ?? 0;
                  return (
                    <div key={sub.key} style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 10, paddingBottom: 3 }}>
                      <span style={{ fontSize: 8, color: '#555', width: 18, flexShrink: 0 }}>{SUB_SHORT[sub.key]}</span>
                      <div style={{ flex: 1, height: 3, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.round(sv * 0.9)}%`, background: g.color, borderRadius: 2, opacity: 0.6 }} />
                      </div>
                      <span style={{ fontSize: 8, color: '#444', width: 28, textAlign: 'right' }}>{sv}</span>
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

// ── Inline player card for matchup (compact) ────────────────────────────────
function MatchupPlayerCard({ player, isBench, color, onClick }) {
  if (!player) return null;
  const CARD_H = 52;
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        background: '#0d0d0d', border: `1px solid ${color}22`, borderRadius: 10,
        padding: '7px 8px', minWidth: 72, flexShrink: 0, gap: 3, opacity: isBench ? 0.75 : 1,
        cursor: 'pointer', transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = color + '66'}
      onMouseLeave={e => e.currentTarget.style.borderColor = color + '22'}
    >
      <div style={{ textAlign: 'center', lineHeight: 1 }}>
        <div style={{ fontSize: 7, color: color + '99' }}>{player.name.split(' ')[0].slice(0, 6)}</div>
        <div style={{ fontSize: 10, color: 'white', fontWeight: 700 }}>{lastName(player.name).slice(0, 9)}</div>
      </div>
      <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: CARD_H }}>
        {CATEGORY_GROUPS.map(g => {
          const val = player[g.key] ?? 0;
          const barH = Math.max(2, Math.round((val / 99) * CARD_H));
          return (
            <div key={g.key} style={{ width: 6, height: CARD_H, background: '#1a1a1a', borderRadius: 2, display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
              <div style={{ width: '100%', height: barH, background: g.color, opacity: 0.85, borderRadius: 2 }} />
            </div>
          );
        })}
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: 'white', fontWeight: 900, lineHeight: 1 }}>{player.eff}</div>
        <div style={{ fontSize: 7, color: color + '88', fontWeight: 700 }}>{player.pos}</div>
      </div>
    </div>
  );
}

// ── Mini court display ────────────────────────────────────────────────────────
function MiniCourt({ lineup, color }) {
  const slots = [
    { key: 'PG', x: 50, y: 88 }, { key: 'SG', x: 18, y: 66 },
    { key: 'SF', x: 82, y: 66 }, { key: 'PF', x: 27, y: 34 }, { key: 'C', x: 73, y: 34 },
  ];
  return (
    <div style={{ width: '100%', position: 'relative', paddingBottom: '62%', background: '#0a0a0a', borderRadius: 10, border: `1px solid ${color}22` }}>
      <svg viewBox="0 0 200 130" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <rect x="5" y="4" width="190" height="122" rx="4" fill="none" stroke="#1f3a1f" strokeWidth="1" />
        <rect x="60" y="4" width="80" height="52" fill="#141a14" stroke="#1f3a1f" strokeWidth="0.8" />
        <ellipse cx="100" cy="56" rx="22" ry="16" fill="none" stroke="#1f3a1f" strokeWidth="0.8" />
        <circle cx="100" cy="15" r="5" fill="none" stroke="#2a502a" strokeWidth="1" />
        <path d="M 18 44 A 88 70 0 0 0 182 44" fill="none" stroke="#1f3a1f" strokeWidth="1" />
        {slots.map(slot => {
          const player = lineup[slot.key];
          const cx = slot.x * 2, cy = slot.y * 1.3;
          return (
            <g key={slot.key}>
              <circle cx={cx} cy={cy} r={9} fill={player ? '#1c1c1c' : '#0d0d0d'} stroke={color} strokeWidth={player ? 1.5 : 0.5} strokeOpacity={player ? 0.8 : 0.2} />
              {player ? (
                <>
                  <text x={cx} y={cy - 1} textAnchor="middle" fill="white" fontSize="4.5" fontWeight="700">{lastName(player.name).slice(0, 7).toUpperCase()}</text>
                  <text x={cx} y={cy + 5} textAnchor="middle" fill={color} fontSize="4">{player.eff}</text>
                </>
              ) : (
                <text x={cx} y={cy + 2} textAnchor="middle" fill={color} fontSize="6" fillOpacity="0.3">{slot.key}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Team side panel ────────────────────────────────────────────────────────────
function TeamSide({ sideLabel, color, lineup, bench, savedTeams, onLoad, score, won, onPlayerClick }) {
  const slotKeys = ['PG', 'SG', 'SF', 'PF', 'C'];
  const filledStarters = slotKeys.map(k => lineup[k]).filter(Boolean);
  const filledBench    = bench.filter(Boolean);
  const allPlayers     = [...filledStarters, ...filledBench];

  const teamOverall = calcWeightedTeamRating(allPlayers, 'eff');

  const teamOptions = [
    ...Object.entries(NBA_TEAMS).sort((a, b) => a[1].name.localeCompare(b[1].name))
      .map(([abbr, t]) => ({ id: abbr, name: `${t.name} (${abbr})` })),
    ...Object.entries(savedTeams).map(([name]) => ({ id: `custom_${name}`, name: `★ ${name}` })),
  ];

  return (
    <div className="matchup-team-block" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header */}
      <div className="matchup-team-selector" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: '#666', fontWeight: 700 }}>{sideLabel}</span>
        <select onChange={e => e.target.value && onLoad(e.target.value)} defaultValue=""
          style={{ flex: 1, background: '#141414', border: `1px solid ${color}44`, borderRadius: 6, color: '#aaa', fontSize: 11, padding: '4px 8px', cursor: 'pointer' }}>
          <option value="">Load team...</option>
          {teamOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {/* Score */}
      {score != null && (
        <div style={{ textAlign: 'center', padding: '10px 0 8px', background: '#111', borderRadius: 8, border: '1px solid #222' }}>
          <p style={{ fontSize: 42, fontWeight: 900, color: won ? '#4ade80' : '#555', margin: 0, lineHeight: 1 }}>{score}</p>
          {won && <span style={{ fontSize: 9, color: '#4ade80', letterSpacing: '0.1em', fontWeight: 700 }}>WIN</span>}
        </div>
      )}

      <MiniCourt lineup={lineup} color={color} />

      {/* Team ratings */}
      {allPlayers.length > 0 && (
        <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 8, padding: '8px 10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 8, color: '#333', fontWeight: 700, letterSpacing: '0.08em' }}>TEAM RATINGS</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
              <span style={{ fontSize: 8, color: '#555', fontWeight: 700 }}>OVR</span>
              <span style={{ fontSize: 18, color: color, fontWeight: 900, lineHeight: 1 }}>{teamOverall}</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 2 }}>
            {CATEGORY_GROUPS.map(g => (
              <div key={g.key} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 7, color: g.color, fontWeight: 700, letterSpacing: '0.03em', marginBottom: 2 }}>{CAT_SHORT[g.key]}</div>
                <div style={{ fontSize: 15, color: 'white', fontWeight: 800 }}>{calcWeightedTeamRating(allPlayers, g.key)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Player cards — starters then bench */}
      {allPlayers.length > 0 && (
        <div>
          {/* Starters row */}
          {filledStarters.length > 0 && (
            <div>
              <p style={{ fontSize: 8, color: '#333', fontWeight: 700, letterSpacing: '0.06em', margin: '0 0 6px', textTransform: 'uppercase' }}>Starters</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {filledStarters.map(p => (
                  <MatchupPlayerCard key={p.id} player={p} isBench={false} color={color} onClick={() => onPlayerClick(p)} />
                ))}
              </div>
            </div>
          )}
          {/* Bench row */}
          {filledBench.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: 8, color: '#333', fontWeight: 700, letterSpacing: '0.06em', margin: '0 0 6px', textTransform: 'uppercase' }}>Bench</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {filledBench.map(p => (
                  <MatchupPlayerCard key={p.id} player={p} isBench={true} color={color} onClick={() => onPlayerClick(p)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Matchup Tab ───────────────────────────────────────────────────────────
export default function MatchupTab({ savedTeams }) {
  const [lineup1, setLineup1] = useState({ PG: null, SG: null, SF: null, PF: null, C: null });
  const [bench1,  setBench1]  = useState([]);
  const [lineup2, setLineup2] = useState({ PG: null, SG: null, SF: null, PF: null, C: null });
  const [bench2,  setBench2]  = useState([]);
  const [result,  setResult]  = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [boxTab,  setBoxTab]  = useState(0);
  const [showBoxOverlay, setShowBoxOverlay] = useState(false);
  const [detailPlayer, setDetailPlayer] = useState(null);

  // Derive team colors from the most common team among starters
  function getLineupColor(lineup, fallback) {
    const teams = Object.values(lineup).filter(Boolean).map(p => p.team);
    if (!teams.length) return fallback;
    const freq = teams.reduce((acc, t) => { acc[t] = (acc[t] || 0) + 1; return acc; }, {});
    const topTeam = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0];
    return getTeamColor(topTeam, fallback);
  }

  const color1 = getLineupColor(lineup1, '#3b82f6');
  const color2 = getLineupColor(lineup2, '#f97316');

  function loadTeam(side, teamId) {
    let teamData = null;
    if (teamId.startsWith('custom_')) teamData = savedTeams[teamId.slice(7)] ?? null;
    else teamData = NBA_TEAMS[teamId] ?? null;
    if (!teamData) return;
    const newLineup = {};
    for (const [pos, id] of Object.entries(teamData.starters || {})) newLineup[pos] = id ? getPlayerById(id) : null;
    const newBench = (teamData.bench || []).map(id => id ? getPlayerById(id) : null).filter(Boolean);
    if (side === 1) { setLineup1(newLineup); setBench1(newBench); }
    else            { setLineup2(newLineup); setBench2(newBench); }
    setResult(null);
  }

  function handleSimulate() {
    setSimulating(true); setBoxTab(0); setShowBoxOverlay(false);
    setTimeout(() => {
      const res = simulateGame(lineup1, bench1, lineup2, bench2);
      setResult(res); setSimulating(false);
    }, 900);
  }

  const canSimulate = Object.values(lineup1).some(Boolean) || Object.values(lineup2).some(Boolean);

  return (
    <div style={{ padding: '14px 20px', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Simulate / result row */}
      <div className="matchup-controls" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
        {result && (
          <span style={{ fontSize: 11, color: '#555' }}>
            {result.score1 > result.score2 ? 'Team A wins' : 'Team B wins'}
            {result.isOvertime ? ' (OT)' : ''}
          </span>
        )}
        <button
          className="simulate-btn"
          onClick={handleSimulate}
          disabled={!canSimulate || simulating}
          style={{
            background: canSimulate ? '#1a3a1a' : '#111', border: `1px solid ${canSimulate ? '#2a5a2a' : '#1a1a1a'}`,
            borderRadius: 8, color: canSimulate ? '#4ade80' : '#333', fontSize: 13, fontWeight: 700,
            padding: '10px 28px', cursor: canSimulate ? 'pointer' : 'default', letterSpacing: '0.02em',
          }}
        >
          {simulating ? 'Simulating…' : '▶ Simulate Game'}
        </button>
        {/* Single box score button — only shown after simulation */}
        {result && (
          <button
            onClick={() => setShowBoxOverlay(true)}
            style={{
              background: '#141414', border: '1px solid #2a2a2a',
              borderRadius: 8, color: '#aaa', fontSize: 11, fontWeight: 700,
              padding: '8px 16px', cursor: 'pointer', letterSpacing: '0.04em',
            }}
          >
            📋 Box Score
          </button>
        )}
        {result && (
          <button onClick={() => setResult(null)} style={{ background: 'none', border: '1px solid #2a2a2a', borderRadius: 8, color: '#444', fontSize: 11, padding: '8px 14px', cursor: 'pointer' }}>
            Reset
          </button>
        )}
      </div>

      {/* Two-column layout */}
      <div className="matchup-courts-row" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <TeamSide
          sideLabel="TEAM A" color={color1}
          lineup={lineup1} bench={bench1}
          savedTeams={savedTeams} onLoad={id => loadTeam(1, id)}
          score={result?.score1} won={result ? result.score1 > result.score2 : false}
          onPlayerClick={setDetailPlayer}
        />
        <div style={{ width: 1, background: '#1a1a1a', alignSelf: 'stretch', flexShrink: 0 }} />
        <TeamSide
          sideLabel="TEAM B" color={color2}
          lineup={lineup2} bench={bench2}
          savedTeams={savedTeams} onLoad={id => loadTeam(2, id)}
          score={result?.score2} won={result ? result.score2 > result.score1 : false}
          onPlayerClick={setDetailPlayer}
        />
      </div>

      {/* ── Player Detail Overlay ─────────────────────────────────────────── */}
      {detailPlayer && (
        <PlayerDetailOverlay
          player={detailPlayer}
          color={
            [...Object.values(lineup1), ...bench1].some(p => p?.id === detailPlayer.id) ? color1 : color2
          }
          onClose={() => setDetailPlayer(null)}
        />
      )}

      {/* ── Box Score Overlay ─────────────────────────────────────────────── */}
      {showBoxOverlay && result && (
        <div
          onClick={() => setShowBoxOverlay(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 14, width: '100%', maxWidth: 720, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #1e1e1e', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 11, color: '#555', fontWeight: 700, letterSpacing: '0.08em' }}>BOX SCORE</span>
                <span style={{ fontSize: 14, color: result.score1 > result.score2 ? '#4ade80' : '#666', fontWeight: 900 }}>{result.score1}</span>
                <span style={{ fontSize: 10, color: '#333' }}>—</span>
                <span style={{ fontSize: 14, color: result.score2 > result.score1 ? '#4ade80' : '#666', fontWeight: 900 }}>{result.score2}</span>
                {result.isOvertime && <span style={{ fontSize: 9, color: '#f97316', fontWeight: 700 }}>OT</span>}
              </div>
              <button onClick={() => setShowBoxOverlay(false)} style={{ background: 'none', border: '1px solid #2a2a2a', borderRadius: 6, color: '#555', fontSize: 14, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <div style={{ display: 'flex', borderBottom: '1px solid #1e1e1e', flexShrink: 0 }}>
              {[{ label: 'TEAM A', color: color1, idx: 0 }, { label: 'TEAM B', color: color2, idx: 1 }].map(t => (
                <button key={t.idx} onClick={() => setBoxTab(t.idx)}
                  style={{ flex: 1, background: boxTab === t.idx ? '#161616' : 'transparent', border: 'none', borderBottom: boxTab === t.idx ? `2px solid ${t.color}` : '2px solid transparent', color: boxTab === t.idx ? t.color : '#444', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', padding: '10px 0', cursor: 'pointer' }}>
                  {t.label} <span style={{ marginLeft: 8, fontSize: 14, fontWeight: 900 }}>{t.idx === 0 ? result.score1 : result.score2}</span>
                </button>
              ))}
            </div>
            <div style={{ overflowY: 'auto', padding: '10px 14px 16px' }}>
              <BoxScoreTable
                boxScores={boxTab === 0 ? result.boxScores1 : result.boxScores2}
                color={boxTab === 0 ? color1 : color2}
                teamName={boxTab === 0 ? 'Team A' : 'Team B'}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
