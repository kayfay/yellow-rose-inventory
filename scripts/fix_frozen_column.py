import logging
import gspread
from utils.sheets import get_sheets_client

logging.basicConfig(level=logging.INFO)

def fix_frozen_row_11():
    gc = get_sheets_client()
    if not gc:
        logging.error("Sheets client not available.")
        return
        
    try:
        sh = gc.open_by_key("1knWAQH74RoeR5U92IHVyToneF2rcnaybmtnrAoBRu3o")
        ws = sh.sheet1
        data = ws.get_all_values()
        
        # Find 'Frozen' column
        frozen_col_idx = -1
        for row_idx, row in enumerate(data[:5]):
            for col_idx, cell_value in enumerate(row):
                if "frozen" in cell_value.lower():
                    frozen_col_idx = col_idx
                    break
            if frozen_col_idx != -1:
                break
                
        if frozen_col_idx == -1:
            logging.error("Could not find 'Frozen' column.")
            return

        # Find 'OH' and 'ORD' under the 'Frozen' column category
        oh_col_idx = -1
        ord_col_idx = -1
        for row_idx, row in enumerate(data[:5]):
            for offset in range(3):
                col_to_check = frozen_col_idx + offset
                if col_to_check < len(row):
                    val = row[col_to_check].lower().strip()
                    if val in ["oh", "on hand"]:
                        oh_col_idx = col_to_check
                    elif val in ["ord", "order"]:
                        ord_col_idx = col_to_check

        cells_to_update = []
        target_row = 11
        
        # If we found exact OH/ORD columns, use them. Otherwise fallback to the next two columns.
        if oh_col_idx != -1:
            cells_to_update.append(gspread.Cell(row=target_row, col=oh_col_idx + 1, value=""))
        else:
            cells_to_update.append(gspread.Cell(row=target_row, col=frozen_col_idx + 1, value=""))
            
        if ord_col_idx != -1:
            cells_to_update.append(gspread.Cell(row=target_row, col=ord_col_idx + 1, value=""))
        else:
            cells_to_update.append(gspread.Cell(row=target_row, col=frozen_col_idx + 2, value=""))

        if cells_to_update:
            ws.update_cells(cells_to_update)
            logging.info(f"Cleared OH and ORD values on row {target_row} under 'Frozen' category.")
        else:
            logging.info("No cells to update.")
            
    except Exception as e:
        logging.error(f"Failed to fix frozen row 11: {e}")

if __name__ == "__main__":
    fix_frozen_row_11()
