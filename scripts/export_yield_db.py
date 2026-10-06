#!/usr/bin/env python3
"""
scripts/export_yield_db.py
Syncs batch yield records from data/batch_yield_history.json into SQLite data/inventory.db
"""

import json
import os
import sqlite3
import sys

def sync_yields():
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    json_path = os.path.join(repo_root, "data", "batch_yield_history.json")
    db_path = os.path.join(repo_root, "data", "inventory.db")
    
    if not os.path.exists(json_path):
        print(f"No batch yield JSON found at {json_path}")
        return
        
    with open(json_path, "r", encoding="utf-8") as f:
        batches = json.load(f)
        
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS batch_yields (
            id TEXT PRIMARY KEY,
            timestamp TEXT,
            item TEXT,
            case_weight REAL,
            post_trim_weight REAL,
            cooked_weight REAL,
            raw_price_per_lb REAL,
            trim_loss_pct REAL,
            cook_shrinkage_pct REAL,
            total_net_yield_pct REAL,
            effective_cooked_cost REAL,
            est_portions INTEGER,
            notes TEXT
        )
    """)
    
    synced_count = 0
    for b in batches:
        cursor.execute("""
            INSERT OR REPLACE INTO batch_yields (
                id, timestamp, item, case_weight, post_trim_weight,
                cooked_weight, raw_price_per_lb, trim_loss_pct,
                cook_shrinkage_pct, total_net_yield_pct, effective_cooked_cost,
                est_portions, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            b.get("id"), b.get("timestamp"), b.get("item"),
            b.get("caseWeight"), b.get("postTrimWeight"), b.get("cookedWeight"),
            b.get("rawPricePerLb"), b.get("trimLossPct"), b.get("cookShrinkagePct"),
            b.get("totalNetYieldPct"), b.get("effectiveCookedCost"), b.get("estPortions", 0),
            b.get("notes", "")
        ))
        synced_count += 1
        
    conn.commit()
    conn.close()
    print(f"✅ Successfully synced {synced_count} batch records into SQLite {db_path}")

if __name__ == "__main__":
    sync_yields()
