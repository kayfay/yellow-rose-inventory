import os
import logging
from utils.db import get_db_connection
from utils.sheets import get_sheets_client

logging.basicConfig(level=logging.INFO)

def export_inventory():
    gc = get_sheets_client()
    if not gc:
        logging.warning("Mocking export for demonstration because Sheets client failed.")
        return
        
    try:
        sheet_id = os.environ.get("SHEET_ID")
        if not sheet_id:
             logging.error("SHEET_ID environment variable not set.")
             return
             
        sh = gc.open_by_key(sheet_id)
        worksheet = sh.sheet1
        
        with get_db_connection() as conn:
            c = conn.cursor()
            c.execute("SELECT item, quantity, last_updated FROM inventory")
            rows = c.fetchall()
            
        db_inventory = {row[0].lower(): row[1] for row in rows}
        
        sheet_data = worksheet.get_all_values()
        if not sheet_data:
            logging.warning("Sheet is empty.")
            return
            
        headers = sheet_data[0]
        item_col_idx = -1
        oh_col_idx = -1
        
        for i, header in enumerate(headers):
            h_lower = header.lower().strip()
            if h_lower in ["item", "product", "description", "name"]:
                item_col_idx = i
            elif h_lower in ["oh", "on hand", "on-hand", "current stock", "qty"]:
                oh_col_idx = i
                
        if item_col_idx == -1 or oh_col_idx == -1:
            logging.error(f"Could not find 'Item' or 'OH' columns. Headers found: {headers}")
            return
            
        cells_to_update = []
        import gspread
        for row_idx, row in enumerate(sheet_data[1:], start=2):
            if len(row) > item_col_idx:
                sheet_item = row[item_col_idx].lower().strip()
                if not sheet_item:
                    continue
                    
                for db_item, db_qty in db_inventory.items():
                    if not db_item:
                        continue
                    
                    if db_item in sheet_item or sheet_item in db_item:
                        cell = gspread.Cell(row=row_idx, col=oh_col_idx + 1, value=db_qty)
                        cells_to_update.append(cell)
                        break
                        
        if cells_to_update:
            worksheet.update_cells(cells_to_update)
            logging.info(f"Successfully updated {len(cells_to_update)} 'On Hand' values safely.")
        else:
            logging.info("No matching items found to update.")
        
    except Exception as e:
        logging.error(f"An error occurred exporting to Google Sheets: {e}")

if __name__ == "__main__":
    export_inventory()
