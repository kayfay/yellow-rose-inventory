import logging
from utils.sheets import get_sheets_client
import gspread

logging.basicConfig(level=logging.INFO)

def fix_blank_rows():
    gc = get_sheets_client()
    if not gc:
        logging.error("Sheets client not available.")
        return
        
    try:
        sh = gc.open_by_key("1knWAQH74RoeR5U92IHVyToneF2rcnaybmtnrAoBRu3o")
        ws = sh.sheet1
        data = ws.get_all_values()
        
        item_col_idx = 0
        oh_col_idx = 2
        
        cells_to_update = []
        for row_idx, row in enumerate(data[1:], start=2):
            item = row[item_col_idx].strip()
            if not item:
                if len(row) > oh_col_idx and row[oh_col_idx]:
                    cells_to_update.append(gspread.Cell(row=row_idx, col=oh_col_idx+1, value=""))
                if len(row) > oh_col_idx+1 and row[oh_col_idx+1]:
                    cells_to_update.append(gspread.Cell(row=row_idx, col=oh_col_idx+2, value=""))
        
        if cells_to_update:
            ws.update_cells(cells_to_update)
            logging.info(f"Cleared {len(cells_to_update)} bad cells in blank rows.")
        else:
            logging.info("No bad cells found.")
    except Exception as e:
        logging.error(f"Failed to fix blank rows: {e}")

if __name__ == "__main__":
    fix_blank_rows()
