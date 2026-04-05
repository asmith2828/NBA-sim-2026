// ─── Lineup Chemistry ─────────────────────────────────────────────────────────
// Chemistry profiles operate at the SUBCATEGORY level for precision.
// Each entry maps a source player's strength to the specific subcategory it boosts
// in teammates — capturing real basketball cause-and-effect chains.
//
// Format: { subcategoryKey: boostValue } (capped at 99 after application)
//
// Cross-subcategory logic: the boosts are intentionally cross-category.
// For example, a rim protector's rimProtection boosts teammates' onBallPressure
// (perimeter defenders can gamble more when the rim is covered), and an elite
// passer's courtVision boosts teammates' shotQuality (better passes = better looks).

import { deriveParentScores } from './metrics';

export const CHEMISTRY_PROFILES = {

  // ─────────────────────────────────────────────────────────────────────────────
  // ATLANTA HAWKS
  // ─────────────────────────────────────────────────────────────────────────────

  // Jalen Johnson (1630552) — Athletic 2-way star, elite finisher + defender
  1630552: {
    driveImpact:      3,
    paintEfficiency:  2,
    offBallAwareness: 2,
    schemeVersatility: 2,
  },

  // Dyson Daniels (1630700) — Elite on-ball disruptor, steals machine
  1630700: {
    onBallPressure:   4,
    offBallAwareness: 3,
    schemeVersatility: 2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // BOSTON CELTICS
  // ─────────────────────────────────────────────────────────────────────────────

  // Jayson Tatum (1628369) — Versatile scorer, 2-way play
  1628369: {
    shotQuality:       2,
    driveImpact:       2,
    schemeVersatility: 2,
  },

  // Jaylen Brown (1627759) — Physical 2-way anchor
  1627759: {
    onBallPressure:   2,
    driveImpact:      2,
    offBallAwareness: 2,
  },

  // Jrue Holiday (201950) — Elite defensive disruptor
  201950: {
    onBallPressure:   4,
    offBallAwareness: 3,
    schemeVersatility: 2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // CHARLOTTE HORNETS
  // ─────────────────────────────────────────────────────────────────────────────

  // LaMelo Ball (1630163) — Flashy full-court distributor
  1630163: {
    courtVision:      3,
    ballMovement:     3,
    shootingGravity:  2,
    paintEfficiency:  2,
    driveImpact:      2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // CHICAGO BULLS
  // ─────────────────────────────────────────────────────────────────────────────

  // Josh Giddey (1630581) — Elite playmaker, true point forward
  1630581: {
    ballMovement:    3,
    courtVision:     2,
    paintEfficiency: 2,
    decisionQuality: 2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // CLEVELAND CAVALIERS
  // ─────────────────────────────────────────────────────────────────────────────

  // Donovan Mitchell (1628378) — Dynamic scorer, two-way player
  1628378: {
    shotQuality:     2,
    driveImpact:     2,
    shootingGravity: 2,
  },

  // Evan Mobley (1630596) — Elite defensive anchor
  1630596: {
    rimProtection:   4,
    onBallPressure:  3,
    paintDeterrence: 2,
    defRebounding:   2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // DALLAS MAVERICKS
  // ─────────────────────────────────────────────────────────────────────────────

  // Klay Thompson (202691) — One of the greatest shooters, legendary floor spacer
  202691: {
    shootingGravity: 4,
    shotQuality:     3,
    offBallAwareness: 2,
  },

  // Cooper Flagg (1642843) — Elite 2-way rookie, defensive IQ beyond his years
  1642843: {
    onBallPressure:   2,
    driveImpact:      2,
    schemeVersatility: 3,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // DENVER NUGGETS
  // ─────────────────────────────────────────────────────────────────────────────

  // Nikola Jokić (203999) — World-class court vision; perimeter liability
  203999: {
    decisionQuality:  2,
    shotQuality:      2,
    paintEfficiency:  3,
    offBallAwareness: 2,
    onBallPressure:  -2,
    schemeVersatility:-1,
  },

  // Jamal Murray (1627750) — Elite shot creator, complements Jokić
  1627750: {
    shotQuality:     2,
    shootingGravity: 2,
    ballMovement:    2,
    decisionQuality: 2,
  },

  // Michael Porter Jr. (1629008) — Elite floor-stretching shooter
  1629008: {
    shootingGravity: 3,
    shotQuality:     2,
  },

  // Aaron Gordon (203932) — Athletic defender, rim-runner + switchable big
  203932: {
    paintDeterrence:  2,
    driveImpact:      2,
    offBallAwareness: 2,
    schemeVersatility: 2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // DETROIT PISTONS
  // ─────────────────────────────────────────────────────────────────────────────

  // Cade Cunningham (1630595) — Point-forward, elite facilitator
  1630595: {
    ballMovement:    3,
    driveImpact:     2,
    shotQuality:     2,
    decisionQuality: 2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // GOLDEN STATE WARRIORS
  // ─────────────────────────────────────────────────────────────────────────────

  // Stephen Curry (201939) — Maximum shooting gravity
  201939: {
    shotQuality:     5,
    shootingGravity: 3,
    driveImpact:     2,
    decisionQuality: 2,
  },

  // Draymond Green (203110) — Defensive mastermind/IQ anchor
  203110: {
    onBallPressure:   3,
    paintDeterrence:  3,
    decisionQuality:  2,
    offBallAwareness: 3,
    schemeVersatility: 2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // HOUSTON ROCKETS
  // ─────────────────────────────────────────────────────────────────────────────

  // Kevin Durant (201142) — Unguardable scorer, extreme spacing
  201142: {
    shotQuality:     2,
    shootingGravity: 4,
    driveImpact:     2,
  },

  // Alperen Şengün (1630578) — Jokić-lite passer from the post
  1630578: {
    decisionQuality: 2,
    paintEfficiency: 3,
    shotQuality:     2,
    ballMovement:    2,
    onBallPressure: -1,
  },

  // Jalen Green (1630224) — Explosive scorer
  1630224: {
    shootingGravity: 3,
    driveImpact:     2,
    shotQuality:     2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // INDIANA PACERS
  // ─────────────────────────────────────────────────────────────────────────────

  // Pascal Siakam (1627783) — Versatile 2-way forward, high-IQ scorer
  1627783: {
    driveImpact:       2,
    shotQuality:       2,
    schemeVersatility: 3,
    offBallAwareness:  2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // LA CLIPPERS
  // ─────────────────────────────────────────────────────────────────────────────

  // Kawhi Leonard (202695) — Elite two-way stopper
  202695: {
    onBallPressure:   3,
    paintDeterrence:  2,
    schemeVersatility: 3,
    shotQuality:      2,
  },

  // Darius Garland (1629636) — Elite playmaker, shot creator
  1629636: {
    shotQuality:     2,
    driveImpact:     2,
    ballMovement:    3,
    decisionQuality: 2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // LOS ANGELES LAKERS
  // ─────────────────────────────────────────────────────────────────────────────

  // LeBron James (2544) — Elite playmaker + transition orchestrator
  2544: {
    courtVision:      3,
    driveImpact:      3,
    transitionScoring: 2,
    paintEfficiency:  2,
    shootingGravity:  2,
  },

  // Luka Dončić (1629029) — Gravity + drive creation; poor off-ball D
  1629029: {
    shootingGravity:  3,
    driveImpact:      2,
    shotQuality:      2,
    offBallAwareness: 2,
    onBallPressure:  -2,
    schemeVersatility:-1,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // MEMPHIS GRIZZLIES
  // ─────────────────────────────────────────────────────────────────────────────

  // Ja Morant (1629630) — Fastest drive-and-collapse in basketball
  1629630: {
    driveImpact:      4,
    transitionScoring: 2,
    paintEfficiency:  2,
    shootingGravity:  2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // MIAMI HEAT
  // ─────────────────────────────────────────────────────────────────────────────

  // Bam Adebayo (1628389) — Defensive versatility anchor
  1628389: {
    onBallPressure:   2,
    paintDeterrence:  3,
    offBallAwareness: 2,
    defRebounding:    2,
  },

  // Jimmy Butler (202710) — Elite two-way intensity leader
  202710: {
    onBallPressure:   3,
    schemeVersatility: 3,
    driveImpact:      2,
    paintEfficiency:  2,
  },

  // Tyler Herro (1629639) — Elite off-ball shooter
  1629639: {
    shootingGravity: 2,
    shotQuality:     2,
    driveImpact:     2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // MILWAUKEE BUCKS
  // ─────────────────────────────────────────────────────────────────────────────

  // Giannis Antetokounmpo (203507) — Unstoppable drives collapse defenses
  203507: {
    shootingGravity: 4,
    transitionScoring: 2,
    driveImpact:     2,
    paintDeterrence: 2,
  },

  // Myles Turner (1626167) — Elite rim protector + perimeter shooting stretch big
  1626167: {
    rimProtection:   4,
    shootingGravity: 3,
    paintDeterrence: 2,
    onBallPressure:  2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // MINNESOTA TIMBERWOLVES
  // ─────────────────────────────────────────────────────────────────────────────

  // Rudy Gobert (203497) — Defensive fortress; floor collapses offensively
  203497: {
    rimProtection:    6,
    onBallPressure:   3,
    defRebounding:    3,
    transitionScoring: 2,
    shootingGravity: -3,
    shotQuality:     -2,
    driveImpact:     -1,
  },

  // Anthony Edwards (1630162) — Two-way superstar
  1630162: {
    shootingGravity: 3,
    driveImpact:     3,
    onBallPressure:  2,
    shotQuality:     2,
  },

  // Julius Randle (203944) — Physical forward, good passer
  203944: {
    driveImpact:     2,
    paintEfficiency: 2,
    shotQuality:     2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // NEW ORLEANS PELICANS
  // ─────────────────────────────────────────────────────────────────────────────

  // Zion Williamson (1629627) — Unstoppable paint force; floor collapses
  1629627: {
    driveImpact:     4,
    paintEfficiency: 3,
    transitionScoring: 2,
    shootingGravity: -2,
  },

  // Dejounte Murray (1627749) — Two-way guard, elite facilitator + disruptor
  1627749: {
    onBallPressure:   3,
    offBallAwareness: 2,
    driveImpact:      2,
    ballMovement:     2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // NEW YORK KNICKS
  // ─────────────────────────────────────────────────────────────────────────────

  // Jalen Brunson (1628973) — Elite pick-and-roll scorer/facilitator
  1628973: {
    shotQuality:     2,
    driveImpact:     3,
    paintEfficiency: 2,
    ballMovement:    2,
  },

  // Karl-Anthony Towns (1626157) — Elite stretch big, massive spacing
  1626157: {
    shootingGravity: 4,
    shotQuality:     2,
    driveImpact:     2,
    onBallPressure: -1,
  },

  // OG Anunoby (1628384) — Elite perimeter defender
  1628384: {
    onBallPressure:   3,
    schemeVersatility: 3,
    offBallAwareness: 2,
  },

  // Mikal Bridges (1628969) — Lockdown wing, relentless defender
  1628969: {
    onBallPressure:   2,
    schemeVersatility: 3,
    offBallAwareness: 2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // OKLAHOMA CITY THUNDER
  // ─────────────────────────────────────────────────────────────────────────────

  // Shai Gilgeous-Alexander (1628983) — Elite scorer + on-ball defender
  1628983: {
    driveImpact:     3,
    shotQuality:     3,
    onBallPressure:  3,
    shootingGravity: 2,
  },

  // Jalen Williams (1631114) — Two-way star
  1631114: {
    shotQuality:     2,
    driveImpact:     2,
    onBallPressure:  2,
  },

  // Chet Holmgren (1631096) — Stretch big + elite shot blocker
  1631096: {
    rimProtection:   3,
    shootingGravity: 3,
    onBallPressure:  2,
    paintDeterrence: 2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // ORLANDO MAGIC
  // ─────────────────────────────────────────────────────────────────────────────

  // Paolo Banchero (1631094) — Dominant post scorer + playmaker
  1631094: {
    driveImpact:     3,
    paintEfficiency: 2,
    shotQuality:     2,
  },

  // Franz Wagner (1630532) — Versatile scorer and playmaker
  1630532: {
    shotQuality:      2,
    driveImpact:      2,
    schemeVersatility: 2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // PHILADELPHIA 76ERS
  // ─────────────────────────────────────────────────────────────────────────────

  // Joel Embiid (203954) — Post dominance forces help, rim protection
  203954: {
    shootingGravity: 3,
    shotQuality:     2,
    rimProtection:   2,
    paintEfficiency: 2,
  },

  // Tyrese Maxey (1630178) — Elite speed + shooting gravity
  1630178: {
    shootingGravity: 3,
    driveImpact:     2,
    transitionScoring: 2,
  },

  // Paul George (202331) — Versatile two-way wing
  202331: {
    shotQuality:      2,
    schemeVersatility: 2,
    onBallPressure:   2,
    shootingGravity:  2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // PHOENIX SUNS
  // ─────────────────────────────────────────────────────────────────────────────

  // Devin Booker (1626164) — Efficient scorer keeps defense honest
  1626164: {
    shootingGravity: 2,
    driveImpact:     2,
    shotQuality:     2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // SACRAMENTO KINGS
  // ─────────────────────────────────────────────────────────────────────────────

  // De'Aaron Fox (1628368) — Fastest in the game, transition maestro (now SAS)
  1628368: {
    transitionScoring: 3,
    driveImpact:      3,
    shootingGravity:  2,
  },

  // Domantas Sabonis (1627734) — Jokić-lite passer/rebounder
  1627734: {
    paintEfficiency: 3,
    decisionQuality: 2,
    defRebounding:   3,
    ballMovement:    2,
    onBallPressure: -1,
  },

  // DeMar DeRozan (201942) — Clutch mid-range scoring, high-IQ playmaker
  201942: {
    shotQuality:     3,
    driveImpact:     2,
    shootingGravity: 2,
    decisionQuality: 2,
  },

  // Zach LaVine (203897) — Elite athlete/scorer, massive gravity (now SAC)
  203897: {
    shootingGravity:  3,
    driveImpact:      3,
    shotQuality:      2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // SAN ANTONIO SPURS
  // ─────────────────────────────────────────────────────────────────────────────

  // Victor Wembanyama (1641705) — Generational: gravity + rim protection
  1641705: {
    rimProtection:   5,
    onBallPressure:  3,
    shootingGravity: 3,
    defRebounding:   2,
    paintDeterrence: 3,
  },

  // Devin Vassell (1630170) — Defensive guard, floor spacer
  1630170: {
    onBallPressure:   2,
    schemeVersatility: 2,
    shootingGravity:  2,
    offBallAwareness: 2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // TORONTO RAPTORS
  // ─────────────────────────────────────────────────────────────────────────────

  // Scottie Barnes (1630567) — Versatile playmaker
  1630567: {
    driveImpact:     2,
    ballMovement:    2,
    offBallAwareness: 2,
  },

  // Brandon Ingram (1627742) — Versatile scorer (now TOR)
  1627742: {
    shotQuality:     2,
    driveImpact:     2,
    shootingGravity: 2,
  },

  // RJ Barrett (1629628) — Physical scorer, strong finisher
  1629628: {
    driveImpact:     2,
    shotQuality:     2,
    onBallPressure:  2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // UTAH JAZZ
  // ─────────────────────────────────────────────────────────────────────────────

  // Lauri Markkanen (1628374) — Elite stretch big
  1628374: {
    shootingGravity: 3,
    driveImpact:     2,
    shotQuality:     2,
  },

  // Jaren Jackson Jr. (1628991) — DPOY candidate, stretch big (now UTA)
  1628991: {
    rimProtection:   4,
    onBallPressure:  3,
    shootingGravity: 2,
    paintDeterrence: 2,
    defRebounding:   2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // WASHINGTON WIZARDS
  // ─────────────────────────────────────────────────────────────────────────────

  // Trae Young (1629027) — Elite distributor; opponents hunt him on D (now WAS)
  1629027: {
    paintEfficiency:  5,
    shotQuality:      2,
    ballMovement:     2,
    shootingGravity:  2,
    onBallPressure:  -3,
    offBallAwareness:-2,
    schemeVersatility:-2,
  },

  // Anthony Davis (203076) — Rim protection anchor (now WAS)
  203076: {
    rimProtection:    4,
    onBallPressure:   2,
    defRebounding:    2,
    transitionScoring: 2,
  },

  // Alex Sarr (1642259) — Versatile young center, rim protection + floor stretch
  1642259: {
    rimProtection:   3,
    shootingGravity: 2,
    onBallPressure:  2,
    paintDeterrence: 2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // CLEVELAND CAVALIERS
  // ─────────────────────────────────────────────────────────────────────────────

  // James Harden (201935) — Elite facilitator; defensive liability (now CLE)
  201935: {
    shootingGravity: 3,
    shotQuality:     3,
    driveImpact:     2,
    ballMovement:    3,
    onBallPressure: -3,
    offBallAwareness:-1,
  },

};

// ─── Apply teammate chemistry to a player ────────────────────────────────────
// Boosts operate on subcategory keys. After boosting, parent scores are
// re-derived so all downstream consumers (calcEffectiveness, bars) stay in sync.
export function applyChemistry(player, teammates) {
  const boosted = { ...player };
  for (const tm of teammates) {
    const profile = CHEMISTRY_PROFILES[tm.id];
    if (!profile) continue;
    for (const [metric, boost] of Object.entries(profile)) {
      if (boosted[metric] !== undefined) {
        boosted[metric] = Math.min(99, Math.max(0, boosted[metric] + boost));
      }
    }
  }
  // Re-derive parent category scores from the boosted subcategory values
  return deriveParentScores(boosted);
}

// ─── Human-readable chemistry labels ─────────────────────────────────────────
export function getChemistryLabel(playerId) {
  const labels = {
    // ATL
    1630552: 'Athletic star · elite finisher + two-way engine',
    1630700: 'Steals machine · disruptive on-ball pressure',
    // BOS
    1628369: 'Versatile scorer · drives, shoots, defends',
    1627759: '2-way anchor · raises team defensive floor',
    201950:  'Defensive disruptor · elite on-ball pressure',
    // CHA
    1630163: 'Full-court vision · fluid ball movement',
    // CHI
    1630581: 'True point forward · playmaking + court vision',
    // CLE
    1628378: 'Scoring punch · creates kick-out patterns',
    1630596: 'Defensive anchor · frees up perimeter gambling',
    201935:  'Elite facilitator · playmaking gravity creator',
    // DAL
    202691:  'Greatest shooter · legendary floor gravity',
    1642843: 'Elite rookie · two-way IQ beyond his years',
    // DEN
    203999:  'Elite passer · elevates shot quality & cutting',
    1627750: 'Clutch shot creator · Jokić system IQ',
    1629008: 'Floor spacer · maximum perimeter stretch',
    203932:  'Athletic defender · rim runner + switchable big',
    // DET
    1630595: 'Point-forward · elite facilitator',
    // GSW
    201939:  'Max gravity · the greatest floor spacer ever',
    203110:  'IQ anchor · maximum defensive awareness lift',
    202710:  'Defensive intensity · two-way leadership',
    // HOU
    201142:  'Unguardable · extreme spacing for teammates',
    1630578: 'Post distributor · finding cutters from the paint',
    // IND
    1627783: 'Versatile two-way · high-IQ scorer and defender',
    // LAC
    202695:  'Elite stopper · contagious defensive IQ',
    1629636: 'Elite playmaker · shot creator + ball mover',
    // LAL
    2544:    'Transition maestro · court vision legend',
    1629029: 'Gravity monster · best creator on the planet',
    // MEM
    1629630: 'Transition pace · drive-collapse maestro',
    // MIA
    1628389: 'Defensive versatility · enables perimeter gambling',
    202710:  'Defensive intensity · two-way leadership',
    1629639: 'Off-ball shooter · spacing and gravity',
    // MIL
    203507:  'Rim pressure · opens 3s + transition chains',
    1626167: 'Stretch rim protector · blocks + spacing combo',
    // MIN
    203497:  'Interior fortress · liberates the entire D',
    1630162: 'Two-way superstar · gravity + perimeter defense',
    203944:  'Physical forward · drive-and-dish patterns',
    // NOP
    1629627: 'Paint force · drive-collapse specialist',
    1627749: 'Two-way guard · steals chains + playmaking',
    // NYK
    1628973: 'P&R maestro · elite scoring facilitator',
    1626157: 'Stretch anchor · maximum floor spacing',
    1628384: 'Elite stopper · perimeter defense standard',
    1628969: 'Lockdown wing · relentless defensive presence',
    // OKC
    1628983: 'Two-way superstar · scorer and on-ball anchor',
    1631114: 'Two-way star · scoring + defensive pressure',
    1631096: 'Stretch shot-blocker · rim protection + spacing',
    // ORL
    1631094: 'Post playmaker · physical drive-and-dish',
    1630532: 'Versatile wing · scoring and scheme flexibility',
    // PHI
    203954:  'Post anchor · boosts spacing + rim protection',
    1630178: 'Speed gravity · elite drive-and-kick',
    202331:  'Two-way veteran · defensive scheme versatility',
    // PHX
    1626164: 'Efficient scorer · keeps defense honest',
    1630224: 'Explosive scorer · shooting gravity + drives',
    // SAC
    1628368: 'Speed demon · transition chain specialist',
    1627734: 'Post distributor · rebounding + passing anchor',
    201942:  'Clutch scorer · mid-range master + IQ playmaker',
    203897:  'Explosive gravity · drive-and-kick specialist',
    // SAS
    1641705: 'Generational talent · gravity + rim protection',
    1630170: 'Defensive guard · floor spacer + pressure',
    // TOR
    1630567: 'Versatile playmaker · two-way flexibility',
    1627742: 'Versatile scorer · creates kick-out patterns',
    1629628: 'Physical scorer · finisher + on-ball pressure',
    // UTA
    1628374: 'Elite stretch big · maximum floor spacing',
    1628991: 'DPOY candidate · rim protection + shooting',
    // WAS
    1629027: 'Elite distributor · maximizes every touch',
    203076:  'Rim protector · unlocks perimeter aggression',
    1642259: 'Versatile young big · rim protection + stretch',
  };
  return labels[playerId] || 'Quality contributor';
}
