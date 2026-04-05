#!/usr/bin/env python3
"""
enrich_heights.py
=================
Adds player_height_inches to all_players_2025_26.json
by pulling a single LeagueDashPlayerBioStats call.

Run once after nba_data_pipeline.py:
    python3 enrich_heights.py
"""
import json
from pathlib import Path
from nba_api.stats.endpoints import LeagueDashPlayerBioStats

INPUT_JSON = Path("all_players_2025_26.json")

print("Fetching bio stats for heights...")
bio = LeagueDashPlayerBioStats(per_mode_simple="PerGame").get_data_frames()[0]
height_map = dict(zip(bio["PLAYER_ID"].astype(int), bio["PLAYER_HEIGHT_INCHES"]))
print(f"Got heights for {len(height_map)} players")

with open(INPUT_JSON) as f:
    data = json.load(f)

updated = 0
missing = 0
for p in data["players"]:
    pid = int(p.get("player_id", 0))
    h = height_map.get(pid)
    if h is not None:
        p["player_height_inches"] = int(h)
        updated += 1
    else:
        p["player_height_inches"] = None
        missing += 1

print(f"Updated {updated} players with height, {missing} missing")
with open(INPUT_JSON, "w") as f:
    json.dump(data, f, indent=2)
print("Done. Now run: python3 convert_to_js.py")
