import datetime
import logging
from utils.db import get_db_connection

logging.basicConfig(level=logging.INFO)

YIELD_RATIO = 0.55

CLOVER_RECIPES = {
    "Brisket Sandwich": {"meat": "Brisket (Raw)", "oz_ep": 7.0},
    "Pulled Pork Sandwich": {"meat": "Pork Butt (Raw)", "oz_ep": 8.0},
    "Rosebud": {"meat": "Brisket (Raw)", "oz_ep": 4.0},
    "Hill Country Trinity": {"meat": "Brisket (Raw)", "oz_ep": 5.5}, 
    "Crispy Quesa Taco Brisket": {"meat": "Brisket (Raw)", "oz_ep": 2.0}
}

def deplete_inventory(sales_data):
    now = datetime.datetime.now().isoformat()
    
    try:
        with get_db_connection() as conn:
            c = conn.cursor()
            for item, quantity_sold in sales_data.items():
                if item in CLOVER_RECIPES:
                    recipe = CLOVER_RECIPES[item]
                    meat_name = recipe["meat"]
                    oz_ep = recipe["oz_ep"]
                    
                    total_oz_ep = oz_ep * quantity_sold
                    total_lbs_ep = total_oz_ep / 16.0
                    total_lbs_ap = total_lbs_ep / YIELD_RATIO
                    
                    c.execute("SELECT quantity FROM inventory WHERE item = ?", (meat_name,))
                    row = c.fetchone()
                    if row:
                        current_qty = row[0]
                        if "Brisket" in meat_name:
                            case_weight = 80.0
                        elif "Pork Butt" in meat_name:
                            case_weight = 32.0
                        else:
                            case_weight = 1.0
                            
                        cases_used = total_lbs_ap / case_weight
                        new_qty = current_qty - cases_used
                        
                        c.execute("UPDATE inventory SET quantity = ?, last_updated = ? WHERE item = ?",
                                  (new_qty, now, meat_name))
                        logging.info(f"Clover Sale: {quantity_sold}x {item} used {total_lbs_ap:.2f} lbs raw. Depleted {cases_used:.2f} cases of {meat_name}.")
                    else:
                        logging.warning(f"{meat_name} not found in inventory to deplete.")
    except Exception as e:
        logging.error(f"Failed to simulate clover sales depletion: {e}")

if __name__ == "__main__":
    sample_clover_payload = {
        "Brisket Sandwich": 45,
        "Rosebud": 20,
        "Crispy Quesa Taco Brisket": 30,
        "Pulled Pork Sandwich": 25
    }
    
    logging.info("--- Running Clover POS Depletion Engine ---")
    deplete_inventory(sample_clover_payload)
