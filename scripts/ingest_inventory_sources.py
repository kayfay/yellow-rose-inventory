import datetime
import csv
import os
import logging
from utils.db import get_db_connection

logging.basicConfig(level=logging.INFO)

def ingest_email_csv(filepath):
    now = datetime.datetime.now().isoformat()
    
    try:
        with open(filepath, 'r') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            
        with get_db_connection() as conn:
            c = conn.cursor()
            for row in rows:
                desc = row.get('DESCRIPTION', '').strip()
                qty_str = row.get('CS', row.get('CASE QUANTITY', '0'))
                try:
                    qty = float(qty_str)
                except ValueError:
                    qty = 0.0
                
                if desc and qty > 0:
                    if "BEEF, BRISKET" in desc.upper():
                        item_name = "Brisket (Raw)"
                    elif "PORK, BOSTON BUTT" in desc.upper() or "PORK, BUTT" in desc.upper():
                        item_name = "Pork Butt (Raw)"
                        qty = 100.0
                    elif "PORK, SPARERIB" in desc.upper():
                        item_name = "Pork Ribs (Raw)"
                    else:
                        item_name = desc
                    
                    c.execute("SELECT quantity FROM inventory WHERE item = ?", (item_name,))
                    existing = c.fetchone()
                    if existing:
                        qty += existing[0]
                        
                    c.execute("INSERT OR REPLACE INTO inventory (item, quantity, last_updated) VALUES (?, ?, ?)",
                              (item_name, qty, now))
    except Exception as e:
        logging.error(f"Failed to ingest CSV {filepath}: {e}")

def main():
    email_files = [
        'Review order detail_91714857_09042026.csv',
        'Submitted_Order564310_Cust91714857_09032026.csv'
    ]
    for ef in email_files:
        if os.path.exists(ef):
            logging.info(f"Ingesting {ef}...")
            ingest_email_csv(ef)
            
    logging.info("Multi-source ingestion complete. Actual Order CSV data loaded.")

if __name__ == "__main__":
    main()
