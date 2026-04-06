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

  // Jarrett Allen (1628386) — Rim runner + elite rim protector, great rebounder
  1628386: {
    rimProtection:   3,
    defRebounding:   3,
    paintDeterrence: 2,
    paintEfficiency: 2,
  },

  // Dean Wade (1629731) — Stretch big, floor spacer
  1629731: {
    shootingGravity: 2,
    schemeVersatility: 2,
  },

  // Dennis Schröder (203471) — Scoring PG, pick-and-roll
  203471: {
    driveImpact:     2,
    shotQuality:     2,
    ballMovement:    2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // ATLANTA HAWKS
  // ─────────────────────────────────────────────────────────────────────────────

  // CJ McCollum (203468) — Crafty veteran scorer, good facilitator
  203468: {
    shotQuality:     2,
    driveImpact:     2,
    ballMovement:    2,
  },

  // Nickeil Alexander-Walker (1629638) — Athletic two-way guard
  1629638: {
    onBallPressure:   2,
    offBallAwareness: 2,
    schemeVersatility: 2,
  },

  // Onyeka Okongwu (1630168) — Athletic rim protector, energetic rebounder
  1630168: {
    rimProtection:   3,
    paintDeterrence: 2,
    defRebounding:   2,
    driveImpact:     2,
  },

  // Zaccharie Risacher (1642258) — Young French floor spacer
  1642258: {
    shootingGravity: 2,
    shotQuality:     2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // BROOKLYN NETS
  // ─────────────────────────────────────────────────────────────────────────────

  // Nic Claxton (1629651) — Athletic rim runner + rim protector
  1629651: {
    rimProtection:   3,
    paintDeterrence: 2,
    paintEfficiency: 2,
  },

  // Terance Mann (1629611) — Versatile glue player, solid defender
  1629611: {
    schemeVersatility: 2,
    offBallAwareness:  2,
  },

  // Noah Clowney (1641730) — Athletic big, improving defender
  1641730: {
    rimProtection:   2,
    defRebounding:   2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // BOSTON CELTICS
  // ─────────────────────────────────────────────────────────────────────────────

  // Derrick White (1628401) — Elite two-way guard, versatile defender
  1628401: {
    onBallPressure:   3,
    offBallAwareness: 2,
    schemeVersatility: 2,
    shootingGravity:  2,
  },

  // Sam Hauser (1630573) — Elite floor spacer, pure catch-and-shoot
  1630573: {
    shootingGravity: 3,
    shotQuality:     2,
  },

  // Neemias Queta (1629674) — High-energy rim protector, active rebounder
  1629674: {
    rimProtection:   3,
    paintDeterrence: 2,
    defRebounding:   2,
  },

  // Payton Pritchard (1630202) — Elite shooter, crafty off-the-dribble scorer
  1630202: {
    shootingGravity: 3,
    shotQuality:     2,
    driveImpact:     2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // CHARLOTTE HORNETS
  // ─────────────────────────────────────────────────────────────────────────────

  // Brandon Miller (1641706) — Athletic wing, versatile scorer
  1641706: {
    shotQuality:     2,
    driveImpact:     2,
    shootingGravity: 2,
  },

  // Miles Bridges (1628970) — Explosive athlete, strong finisher
  1628970: {
    driveImpact:      2,
    paintEfficiency:  2,
    transitionScoring: 2,
  },

  // Moussa Diabaté (1631217) — Athletic rim runner, energetic big
  1631217: {
    paintEfficiency: 2,
    rimProtection:   2,
    driveImpact:     2,
  },

  // Coby White (1629632) — Scorer/shooter, good off-the-dribble
  1629632: {
    shotQuality:     2,
    shootingGravity: 2,
    driveImpact:     2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // CHICAGO BULLS
  // ─────────────────────────────────────────────────────────────────────────────

  // Tre Jones (1630200) — Pure PG, solid playmaker + defender
  1630200: {
    ballMovement:    2,
    decisionQuality: 2,
    onBallPressure:  2,
  },

  // Isaac Okoro (1630171) — Defensive wing, physical
  1630171: {
    onBallPressure:   2,
    schemeVersatility: 2,
    offBallAwareness: 2,
  },

  // Matas Buzelis (1641824) — Athletic wing, developing scorer
  1641824: {
    shootingGravity: 2,
    driveImpact:     2,
  },

  // Zach Collins (1628380) — Stretch big, pick-and-pop threat
  1628380: {
    shootingGravity: 2,
    paintEfficiency: 2,
  },

  // Anfernee Simons (1629014) — Elite off-the-dribble scorer
  1629014: {
    shootingGravity: 3,
    shotQuality:     3,
    driveImpact:     2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // DALLAS MAVERICKS
  // ─────────────────────────────────────────────────────────────────────────────

  // P.J. Washington (1629023) — Versatile 3-and-D big
  1629023: {
    shootingGravity:  2,
    schemeVersatility: 2,
    paintEfficiency:  2,
  },

  // Daniel Gafford (1629655) — Elite rim runner + shot blocker
  1629655: {
    rimProtection:   3,
    paintDeterrence: 2,
    paintEfficiency: 2,
  },

  // Khris Middleton (203114) — High-IQ veteran scorer
  203114: {
    shotQuality:     2,
    driveImpact:     2,
    shootingGravity: 2,
    decisionQuality: 2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // DENVER NUGGETS
  // ─────────────────────────────────────────────────────────────────────────────

  // Christian Braun (1631128) — Two-way wing, energetic
  1631128: {
    schemeVersatility: 2,
    onBallPressure:   2,
    driveImpact:      2,
  },

  // Cameron Johnson (1629661) — Elite floor spacer, stretch wing
  1629661: {
    shootingGravity: 3,
    shotQuality:     2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // DETROIT PISTONS
  // ─────────────────────────────────────────────────────────────────────────────

  // Duncan Robinson (1629130) — Best off-ball shooter in the league
  1629130: {
    shootingGravity: 4,
    shotQuality:     2,
    offBallAwareness: 2,
  },

  // Ausar Thompson (1641709) — Elite athlete, lockdown wing defender
  1641709: {
    onBallPressure:   3,
    offBallAwareness: 2,
    schemeVersatility: 2,
    transitionScoring: 2,
  },

  // Jalen Duren (1631105) — Explosive rim runner, elite rebounder
  1631105: {
    defRebounding:   3,
    rimProtection:   2,
    paintEfficiency: 2,
  },

  // Tobias Harris (202699) — Veteran forward, efficient scorer
  202699: {
    shotQuality:     2,
    shootingGravity: 2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // GOLDEN STATE WARRIORS
  // ─────────────────────────────────────────────────────────────────────────────

  // Brandin Podziemski (1641764) — Playmaking guard, good vision
  1641764: {
    ballMovement:    2,
    courtVision:     2,
    driveImpact:     2,
  },

  // Kristaps Porziņģis (204001) — Elite stretch big + rim protection
  204001: {
    shootingGravity: 3,
    rimProtection:   3,
    shotQuality:     2,
    paintDeterrence: 2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // HOUSTON ROCKETS
  // ─────────────────────────────────────────────────────────────────────────────

  // Amen Thompson (1641708) — Elite athletic cutter, transition force
  1641708: {
    driveImpact:      3,
    transitionScoring: 2,
    paintEfficiency:  2,
    onBallPressure:   2,
  },

  // Reed Sheppard (1642263) — Young shooter, developing playmaker
  1642263: {
    shootingGravity: 2,
    shotQuality:     2,
  },

  // Jabari Smith Jr. (1631095) — Stretch big, improving rim protector
  1631095: {
    shootingGravity: 2,
    rimProtection:   2,
    paintDeterrence: 2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // INDIANA PACERS
  // ─────────────────────────────────────────────────────────────────────────────

  // Andrew Nembhard (1629614) — Solid PG, excellent IQ, reliable playmaker
  1629614: {
    ballMovement:    2,
    decisionQuality: 2,
    onBallPressure:  2,
  },

  // Aaron Nesmith (1630174) — Physical wing, strong defender
  1630174: {
    onBallPressure:   2,
    driveImpact:      2,
    schemeVersatility: 2,
  },

  // Ivica Zubac (1627826) — Classic screen-setting big, good finisher
  1627826: {
    paintEfficiency: 2,
    rimProtection:   2,
    defRebounding:   2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // LA CLIPPERS
  // ─────────────────────────────────────────────────────────────────────────────

  // Kris Dunn (1627739) — Elite on-ball disruptor, best perimeter defender
  1627739: {
    onBallPressure:   4,
    offBallAwareness: 3,
    schemeVersatility: 2,
  },

  // Brook Lopez (201572) — Elite rim protector + floor stretch big
  201572: {
    rimProtection:   3,
    shootingGravity: 3,
    paintDeterrence: 2,
  },

  // John Collins (1628381) — Athletic big, pop-and-pitch threat
  1628381: {
    paintEfficiency: 2,
    shootingGravity: 2,
    defRebounding:   2,
  },

  // Bennedict Mathurin (1631097) — Athletic scorer, improving two-way
  1631097: {
    driveImpact:      2,
    shootingGravity:  2,
    transitionScoring: 2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // LOS ANGELES LAKERS
  // ─────────────────────────────────────────────────────────────────────────────

  // Austin Reaves (1630559) — Savvy off-ball scorer, underrated facilitator
  1630559: {
    shootingGravity: 3,
    shotQuality:     2,
    ballMovement:    2,
  },

  // Rui Hachimura (1629060) — Athletic forward, catch-and-shoot threat
  1629060: {
    shotQuality:     2,
    paintEfficiency: 2,
    shootingGravity: 2,
  },

  // Deandre Ayton (1629028) — Skilled big, good finisher + rebounder
  1629028: {
    paintEfficiency: 2,
    defRebounding:   2,
    paintDeterrence: 2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // MEMPHIS GRIZZLIES
  // ─────────────────────────────────────────────────────────────────────────────

  // Ty Jerome (1629660) — Shooter, reliable playmaker
  1629660: {
    shootingGravity: 2,
    shotQuality:     2,
    ballMovement:    2,
  },

  // GG Jackson (1641713) — Athletic big/wing, developing scorer
  1641713: {
    shotQuality:     2,
    driveImpact:     2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // MIAMI HEAT
  // ─────────────────────────────────────────────────────────────────────────────

  // Davion Mitchell (1630558) — Elite on-ball defender, physical guard
  1630558: {
    onBallPressure:   3,
    offBallAwareness: 2,
  },

  // Norman Powell (1626181) — Excellent floor spacer, reliable scorer
  1626181: {
    shootingGravity: 3,
    shotQuality:     2,
    driveImpact:     2,
  },

  // Andrew Wiggins (203952) — Athletic two-way wing, improved defender
  203952: {
    onBallPressure:   2,
    driveImpact:      2,
    shootingGravity:  2,
    schemeVersatility: 2,
  },

  // Jaime Jaquez Jr. (1631170) — Versatile defensive wing
  1631170: {
    schemeVersatility: 2,
    onBallPressure:   2,
    driveImpact:      2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // MILWAUKEE BUCKS
  // ─────────────────────────────────────────────────────────────────────────────

  // Gary Trent Jr. (1629018) — Pure shooter, elite floor spacer
  1629018: {
    shootingGravity: 3,
    shotQuality:     2,
  },

  // Kyle Kuzma (1628398) — Versatile scorer, solid mid-range
  1628398: {
    shotQuality:     2,
    driveImpact:     2,
    shootingGravity: 2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // MINNESOTA TIMBERWOLVES
  // ─────────────────────────────────────────────────────────────────────────────

  // Donte DiVincenzo (1628978) — Elite 3-and-D guard
  1628978: {
    shootingGravity:  3,
    onBallPressure:   2,
    schemeVersatility: 2,
  },

  // Jaden McDaniels (1630183) — Versatile defender, improving scorer
  1630183: {
    onBallPressure:    2,
    schemeVersatility: 3,
    shootingGravity:   2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // NEW ORLEANS PELICANS
  // ─────────────────────────────────────────────────────────────────────────────

  // Trey Murphy III (1630530) — Elite floor spacer, improving scorer
  1630530: {
    shootingGravity: 3,
    shotQuality:     2,
  },

  // Herbert Jones (1630529) — Elite perimeter lockdown defender
  1630529: {
    onBallPressure:   3,
    offBallAwareness: 2,
    schemeVersatility: 2,
  },

  // Jordan Poole (1629673) — Scoring guard, shooting gravity; defensive liability
  1629673: {
    shootingGravity:  2,
    shotQuality:      2,
    driveImpact:      2,
    onBallPressure:  -2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // NEW YORK KNICKS
  // ─────────────────────────────────────────────────────────────────────────────

  // Josh Hart (1628404) — Elite hustle/glue player, best guard rebounder
  1628404: {
    defRebounding:    2,
    offBallAwareness: 2,
    onBallPressure:   2,
    driveImpact:      2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // OKLAHOMA CITY THUNDER
  // ─────────────────────────────────────────────────────────────────────────────

  // Luguentz Dort (1629652) — Elite perimeter lockdown, physical defender
  1629652: {
    onBallPressure:   4,
    offBallAwareness: 2,
    schemeVersatility: 2,
  },

  // Isaiah Hartenstein (1628392) — High-IQ big, elite passer + rim protector
  1628392: {
    rimProtection:   3,
    decisionQuality: 2,
    defRebounding:   2,
    paintDeterrence: 2,
  },

  // Cason Wallace (1641717) — Defensive guard, active hands
  1641717: {
    onBallPressure:   2,
    offBallAwareness: 2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // ORLANDO MAGIC
  // ─────────────────────────────────────────────────────────────────────────────

  // Jalen Suggs (1630591) — Athletic PG, excellent two-way guard
  1630591: {
    onBallPressure:  3,
    offBallAwareness: 2,
    driveImpact:     2,
  },

  // Desmond Bane (1630217) — Elite shooter + playmaker
  1630217: {
    shootingGravity: 3,
    shotQuality:     2,
    driveImpact:     2,
  },

  // Wendell Carter Jr. (1628976) — Versatile big, smart rim protector
  1628976: {
    paintDeterrence: 2,
    rimProtection:   2,
    defRebounding:   2,
  },

  // Anthony Black (1641710) — Long versatile defender, improving playmaker
  1641710: {
    onBallPressure:  2,
    offBallAwareness: 2,
    ballMovement:    2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // PHILADELPHIA 76ERS
  // ─────────────────────────────────────────────────────────────────────────────

  // Kelly Oubre Jr. (1626162) — Athletic wing, physical scorer
  1626162: {
    driveImpact:     2,
    shootingGravity: 2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // PHOENIX SUNS
  // ─────────────────────────────────────────────────────────────────────────────

  // Dillon Brooks (1628415) — Physical defender, tough scorer
  1628415: {
    onBallPressure:   2,
    driveImpact:      2,
    schemeVersatility: 2,
  },

  // Mark Williams (1631109) — Athletic young big, rim protector
  1631109: {
    rimProtection:   3,
    defRebounding:   2,
    paintDeterrence: 2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // PORTLAND TRAIL BLAZERS
  // ─────────────────────────────────────────────────────────────────────────────

  // Shaedon Sharpe (1631101) — Explosive scorer, athletic wing
  1631101: {
    shootingGravity:  2,
    driveImpact:      3,
    transitionScoring: 2,
  },

  // Deni Avdija (1630166) — Versatile wing, playmaking forward
  1630166: {
    ballMovement:     2,
    schemeVersatility: 2,
    driveImpact:      2,
  },

  // Toumani Camara (1641739) — Athletic wing, solid two-way defender
  1641739: {
    onBallPressure:   2,
    schemeVersatility: 2,
    defRebounding:    2,
  },

  // Donovan Clingan (1642270) — Young rim protector, elite shot blocker
  1642270: {
    rimProtection:   4,
    paintDeterrence: 3,
    defRebounding:   2,
  },

  // Scoot Henderson (1630703) — Explosive PG, drive-and-collapse threat
  1630703: {
    driveImpact:      3,
    transitionScoring: 2,
    ballMovement:     2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // SACRAMENTO KINGS
  // ─────────────────────────────────────────────────────────────────────────────

  // Russell Westbrook (201566) — Athletic PG, transition + drive; high turnovers
  201566: {
    transitionScoring: 2,
    driveImpact:      2,
    defRebounding:    2,
    decisionQuality: -2,
    courtVision:     -2,
  },

  // De'Andre Hunter (1629631) — Defensive wing, efficient scorer
  1629631: {
    onBallPressure:   2,
    schemeVersatility: 2,
    shotQuality:      2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // SAN ANTONIO SPURS
  // ─────────────────────────────────────────────────────────────────────────────

  // Stephon Castle (1642264) — Athletic PG, developing two-way player
  1642264: {
    onBallPressure:   2,
    driveImpact:      2,
    transitionScoring: 2,
  },

  // Julian Champagnie (1630577) — Floor spacer, athletic wing
  1630577: {
    shootingGravity: 2,
    shotQuality:     2,
  },

  // Keldon Johnson (1629640) — Physical wing, strong finisher
  1629640: {
    driveImpact:     2,
    paintEfficiency: 2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // TORONTO RAPTORS
  // ─────────────────────────────────────────────────────────────────────────────

  // Immanuel Quickley (1630193) — Explosive scorer, great off-the-dribble
  1630193: {
    shotQuality:     2,
    driveImpact:     2,
    shootingGravity: 2,
  },

  // Jakob Poeltl (1627751) — Elite screen-setter, rim protector, passing big
  1627751: {
    rimProtection:   3,
    paintDeterrence: 2,
    decisionQuality: 2,
    defRebounding:   2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // UTAH JAZZ
  // ─────────────────────────────────────────────────────────────────────────────

  // Keyonte George (1641718) — Athletic scorer, gravity on offense
  1641718: {
    shotQuality:     2,
    driveImpact:     2,
    shootingGravity: 2,
  },

  // Kyle Filipowski (1642271) — Smart passing big, stretch threat
  1642271: {
    decisionQuality: 2,
    paintEfficiency: 2,
    shootingGravity: 2,
  },

  // Ace Bailey (1642846) — Athletic young big, improving
  1642846: {
    rimProtection:   2,
    driveImpact:     2,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // WASHINGTON WIZARDS
  // ─────────────────────────────────────────────────────────────────────────────

  // Bilal Coulibaly (1641731) — Elite athletic defender, French prospect
  1641731: {
    onBallPressure:   3,
    offBallAwareness: 2,
    schemeVersatility: 2,
  },

  // Kyshawn George (1642273) — Long versatile wing, improving
  1642273: {
    schemeVersatility: 2,
    onBallPressure:   2,
  },

  // Tre Johnson (1642848) — Young explosive scorer
  1642848: {
    shotQuality:     2,
    driveImpact:     2,
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
