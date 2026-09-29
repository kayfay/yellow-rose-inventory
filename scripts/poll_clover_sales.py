import os
import time
import requests
import logging
from collections import defaultdict
from utils.db import get_db_connection
from simulate_clover_sales import deplete_inventory

logging.basicConfig(level=logging.INFO)

# Load env file from ../yellow-rose-bbq/clover_api/.env
ENV_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../yellow-rose-bbq/clover_api/.env'))

CLOVER_BASE_URL = "https://api.clover.com"
CLOVER_MERCHANT_ID = ""
CLOVER_API_KEY = ""

if os.path.exists(ENV_PATH):
    with open(ENV_PATH, "r") as f:
        for line in f:
            if line.startswith("CLOVER_BASE_URL="):
                CLOVER_BASE_URL = line.strip().split("=")[1]
            elif line.startswith("CLOVER_MERCHANT_ID="):
                CLOVER_MERCHANT_ID = line.strip().split("=")[1]
            elif line.startswith("CLOVER_API_KEY="):
                CLOVER_API_KEY = line.strip().split("=")[1]
else:
    logging.warning(f"No .env file found at {ENV_PATH}")

def get_headers():
    return {
        "Authorization": f"Bearer {CLOVER_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }

def init_sync_tracking():
    """Create a table to track which Clover order IDs have already been processed to prevent double-depletion."""
    try:
        with get_db_connection() as conn:
            c = conn.cursor()
            c.execute('''CREATE TABLE IF NOT EXISTS processed_orders (
                            order_id TEXT PRIMARY KEY,
                            processed_at TEXT
                         )''')
    except Exception as e:
        logging.error(f"Failed to initialize sync tracking: {e}")

def get_processed_orders():
    try:
        with get_db_connection() as conn:
            c = conn.cursor()
            c.execute("SELECT order_id FROM processed_orders")
            return {row[0] for row in c.fetchall()}
    except Exception as e:
        logging.error(f"Failed to fetch processed orders: {e}")
        return set()

def mark_order_processed(order_id):
    now = time.strftime("%Y-%m-%dT%H:%M:%S")
    try:
        with get_db_connection() as conn:
            c = conn.cursor()
            c.execute("INSERT OR IGNORE INTO processed_orders (order_id, processed_at) VALUES (?, ?)", (order_id, now))
    except Exception as e:
        logging.error(f"Failed to mark order {order_id} as processed: {e}")

def poll_and_deplete(hours_back=24):
    if not CLOVER_MERCHANT_ID or not CLOVER_API_KEY:
        logging.error("Clover credentials not found in the .env file. Cannot poll.")
        return

    init_sync_tracking()
    processed_orders = get_processed_orders()

    since_ms = int((time.time() - (hours_back * 3600)) * 1000)
    filter_str = f"modifiedTime>={since_ms}"
    url = f"{CLOVER_BASE_URL}/v3/merchants/{CLOVER_MERCHANT_ID}/orders?limit=1000&expand=lineItems&filter={filter_str}"

    logging.info(f"Fetching Clover orders modified since {hours_back} hours ago...")
    headers = get_headers()
    
    try:
        res = requests.get(url, headers=headers, timeout=30)
        
        if res.status_code != 200:
            logging.error(f"Failed to fetch orders: HTTP {res.status_code} - {res.text}")
            return
            
        elements = res.json().get("elements", [])
        logging.info(f"Fetched {len(elements)} recently modified orders.")
    except Exception as e:
        logging.error(f"Network error while fetching Clover orders: {e}")
        return

    sales_data = defaultdict(int)
    new_order_ids = []

    for order in elements:
        order_id = order.get("id")
        
        # Skip if we already depleted this order
        if order_id in processed_orders:
            continue
            
        # Only process orders that have line items (skip empty or purely custom amount orders)
        line_items = order.get("lineItems", {}).get("elements", [])
        if not line_items:
            continue
            
        # Increment our tally for each item name
        for item in line_items:
            name = item.get("name", "").strip()
            if name:
                sales_data[name] += 1
                
        new_order_ids.append(order_id)

    if sales_data:
        logging.info(f"Aggregated new sales data across {len(new_order_ids)} new orders: {dict(sales_data)}")
        
        # We reuse the existing deplete_inventory logic which handles standard recipes
        deplete_inventory(sales_data)
        
        # Mark as processed so we don't double count on the next run
        for oid in new_order_ids:
            mark_order_processed(oid)
    else:
        logging.info("No new unprocessed sales found to deplete.")

if __name__ == "__main__":
    # When run directly, poll the last 24 hours of orders
    poll_and_deplete(hours_back=24)
