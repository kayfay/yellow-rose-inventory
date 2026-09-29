import logging
from utils.sheets import get_sheets_client

logging.basicConfig(level=logging.INFO)

def check_brisket():
    gc = get_sheets_client()
    if not gc:
        logging.error("Sheets client not available.")
        return
        
    try:
        sh = gc.open_by_key("1knWAQH74RoeR5U92IHVyToneF2rcnaybmtnrAoBRu3o")
        ws = sh.sheet1
        data = ws.get_all_values()
        
        for i, row in enumerate(data):
            item = row[0].lower() if len(row) > 0 else ""
            if "brisket" in item or "pork" in item or "butt" in item:
                logging.info(f"Row {i+1}: {row}")
    except Exception as e:
        logging.error(f"Failed to check brisket rows: {e}")

if __name__ == "__main__":
    check_brisket()
