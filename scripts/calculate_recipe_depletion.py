import datetime
import logging
from utils.db import get_db_connection

logging.basicConfig(level=logging.INFO)

def deplete_pork_butt(orders):
    ep_weight_lbs = (7.0 / 16.0) * orders
    ap_weight_lbs = ep_weight_lbs / 0.55
    
    try:
        with get_db_connection() as conn:
            c = conn.cursor()
            c.execute("SELECT quantity FROM inventory WHERE item = 'Pork Butt (Raw)'")
            row = c.fetchone()
            if row:
                current_qty = row[0]
                new_qty = current_qty - ap_weight_lbs
                now = datetime.datetime.now().isoformat()
                c.execute("UPDATE inventory SET quantity = ?, last_updated = ? WHERE item = 'Pork Butt (Raw)'",
                          (new_qty, now))
                logging.info(f"Depleted {ap_weight_lbs:.2f} lbs for {orders} orders. New stock: {new_qty:.2f} lbs.")
                if new_qty < 50.0:
                    logging.warning(f"EMAIL ALERT: Pork Butt (Raw) inventory is low ({new_qty:.2f} lbs). Reorder required.")
            else:
                logging.warning("Pork Butt not found in inventory.")
    except Exception as e:
        logging.error(f"Failed to deplete pork butt: {e}")

if __name__ == "__main__":
    deplete_pork_butt(100)
