"""
Fetches 2025-26 net ratings from NBA Stats API and patches src/data/players.js
Usage: python3 scripts/fetch_net_ratings.py
Requires: requests  (pip install requests)
"""

import json
import re
import requests
from pathlib import Path

PLAYERS_FILE = Path(__file__).parent.parent / "src" / "data" / "players.js"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.nba.com/",
    "Origin": "https://www.nba.com",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "x-nba-stats-origin": "stats",
    "x-nba-stats-token": "true",
}

PARAMS = {
    "MeasureType": "Advanced",
    "Season": "2025-26",
    "SeasonType": "Regular Season",
    "PerMode": "PerGame",
    "LeagueID": "00",
    "DateFrom": "",
    "DateTo": "",
    "GameScope": "",
    "GameSegment": "",
    "LastNGames": "0",
    "Location": "",
    "Month": "0",
    "OpponentTeamID": "0",
    "Outcome": "",
    "PORound": "0",
    "Period": "0",
    "PlayerExperience": "",
    "PlayerPosition": "",
    "PlusMinus": "N",
    "Rank": "N",
    "SeasonSegment": "",
    "StarterBench": "",
    "TeamID": "0",
    "TwoWay": "0",
    "VsConference": "",
    "VsDivision": "",
}


def fetch_net_ratings():
    print("Fetching 2025-26 advanced stats from NBA Stats API...")
    url = "https://stats.nba.com/stats/leaguedashplayerstats"
    r = requests.get(url, headers=HEADERS, params=PARAMS, timeout=30)
    r.raise_for_status()

    data = r.json()
    result_set = data["resultSets"][0]
    cols = result_set["headers"]
    rows = result_set["rowSet"]

    id_idx      = cols.index("PLAYER_ID")
    name_idx    = cols.index("PLAYER_NAME")
    net_rtg_idx = cols.index("NET_RATING")
    min_idx     = cols.index("MIN")

    ratings = {}
    for row in rows:
        pid     = row[id_idx]
        name    = row[name_idx]
        net_rtg = row[net_rtg_idx]
        minutes = row[min_idx]
        if pid and net_rtg is not None and (minutes or 0) >= 10:
            ratings[pid] = {"name": name, "netRtg": round(float(net_rtg), 1)}

    print(f"Got net ratings for {len(ratings)} players (≥10 min filter)")
    return ratings


def patch_players_file(ratings):
    content = PLAYERS_FILE.read_text(encoding="utf-8")
    lines = content.split("\n")

    patched = 0
    skipped = 0
    result = []
    i = 0

    while i < len(lines):
        line = lines[i]
        id_match = re.match(r"^\s+id:\s*(\d+),", line)

        if id_match:
            player_id = int(id_match.group(1))
            result.append(line)
            i += 1
            # Look ahead up to 6 lines for the netRtg field
            for lookahead in range(6):
                if i >= len(lines):
                    break
                next_line = lines[i]
                rtg_match = re.match(r"^(\s+netRtg:\s*)([^,]+)(,)", next_line)
                if rtg_match:
                    if player_id in ratings:
                        new_val = ratings[player_id]["netRtg"]
                        result.append(f"{rtg_match.group(1)}{new_val}{rtg_match.group(3)}")
                        patched += 1
                    else:
                        result.append(next_line)  # keep null / existing
                        skipped += 1
                    i += 1
                    break
                result.append(next_line)
                i += 1
            continue

        result.append(line)
        i += 1

    PLAYERS_FILE.write_text("\n".join(result), encoding="utf-8")
    print(f"\nPatched  : {patched} players with 2025-26 net ratings")
    print(f"Skipped  : {skipped} players (< 10 min or not in API response)")

    # Show top 20 for sanity check
    top20 = sorted(ratings.items(), key=lambda x: -x[1]["netRtg"])[:20]
    print("\nTop 20 net ratings this season:")
    for pid, p in top20:
        sign = "+" if p["netRtg"] >= 0 else ""
        print(f"  {p['name']:<28} {sign}{p['netRtg']}")


if __name__ == "__main__":
    try:
        ratings = fetch_net_ratings()
        patch_players_file(ratings)
        print("\nDone! Now run:")
        print("  npm run build && git add -A && git commit -m 'Update 2025-26 net ratings' && git push")
    except requests.HTTPError as e:
        print(f"HTTP error: {e}")
        raise SystemExit(1)
    except Exception as e:
        print(f"Error: {e}")
        raise SystemExit(1)
