import logging
from utils.sheets import get_sheets_client

logging.basicConfig(level=logging.INFO)

def debug_sheets():
    gc = get_sheets_client()
    if not gc:
        logging.error("Sheets client not available.")
        return
        
    try:
        sh = gc.open_by_key("1knWAQH74RoeR5U92IHVyToneF2rcnaybmtnrAoBRu3o")
        ws = sh.sheet1
        data = ws.get_all_values()
        
        logging.info("Row 9: " + str(data[8] if len(data) > 8 else "N/A"))
        logging.info("Row 10: " + str(data[9] if len(data) > 9 else "N/A"))
        logging.info("Row 11: " + str(data[10] if len(data) > 10 else "N/A"))
        logging.info("Row 165: " + str(data[164] if len(data) > 164 else "N/A"))
        logging.info("Row 166: " + str(data[165] if len(data) > 165 else "N/A"))
        logging.info("Row 167: " + str(data[166] if len(data) > 166 else "N/A"))
    except Exception as e:
        logging.error(f"Failed to debug sheets: {e}")

if __name__ == "__main__":
    debug_sheets()
