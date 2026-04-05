// NBA team primary accent colors — used for court circles and matchup display
// Chosen for best visibility on a dark (#0d0d0d) background.
export const NBA_TEAM_COLORS = {
  ATL: '#C1D32F',  // Hawks       – bright lime
  BKN: '#AAAAAA',  // Nets        – gray (black/white team; dark bg)
  BOS: '#007A33',  // Celtics     – green
  CHA: '#00B4CC',  // Hornets     – teal
  CHI: '#CE1141',  // Bulls       – red
  CLE: '#FDBB30',  // Cavaliers   – gold
  DAL: '#00538C',  // Mavericks   – blue
  DEN: '#FEC524',  // Nuggets     – gold
  DET: '#C8102E',  // Pistons     – red
  GSW: '#FFC72C',  // Warriors    – gold
  HOU: '#CE1141',  // Rockets     – red
  IND: '#FDBB30',  // Pacers      – gold
  LAC: '#1D428A',  // Clippers    – blue
  LAL: '#FDB927',  // Lakers      – gold
  MEM: '#5D76A9',  // Grizzlies   – light blue
  MIA: '#98002E',  // Heat        – maroon
  MIL: '#00471B',  // Bucks       – dark green
  MIN: '#78BE20',  // Timberwolves– lime green
  NOP: '#85714D',  // Pelicans    – gold
  NYK: '#F58426',  // Knicks      – orange
  OKC: '#007AC1',  // Thunder     – blue
  ORL: '#0077C0',  // Magic       – blue
  PHI: '#006BB6',  // 76ers       – blue
  PHX: '#E56020',  // Suns        – orange
  POR: '#E03A3E',  // Trail Blazers– red
  SAC: '#5A2D81',  // Kings       – purple
  SAS: '#C4CED4',  // Spurs       – silver
  TOR: '#CE1141',  // Raptors     – red
  UTA: '#F9A01B',  // Jazz        – gold
  WAS: '#E31837',  // Wizards     – red
};

export function getTeamColor(teamAbbr, fallback = '#4ade80') {
  return NBA_TEAM_COLORS[teamAbbr] ?? fallback;
}
