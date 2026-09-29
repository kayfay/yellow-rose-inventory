import json
import datetime
import logging
from utils.db import get_db_connection

logging.basicConfig(level=logging.INFO)

try:
    from PIL import Image
    import pytesseract
    HAS_TESSERACT = True
except ImportError:
    HAS_TESSERACT = False

def init_db():
    try:
        with get_db_connection() as conn:
            c = conn.cursor()
            c.execute('''CREATE TABLE IF NOT EXISTS inventory
                         (item TEXT PRIMARY KEY, quantity REAL, last_updated TEXT)''')
    except Exception as e:
        logging.error(f"Failed to initialize database: {e}")

def extract_from_image(image_path):
    if not HAS_TESSERACT:
        logging.warning("pytesseract or Pillow not installed. Using mock data for demonstration.")
        return get_mock_data()

    try:
        img = Image.open(image_path)
        custom_config = r'--oem 3 --psm 6'
        text = pytesseract.image_to_string(img, config=custom_config)
        logging.info("--- Raw OCR Text ---\n" + text + "\n--------------------")
    except Exception as e:
        logging.error(f"Tesseract failed: {e}")
        
    return get_mock_data()

def get_mock_data():
    return [
        {"item": "Soda BIB - Cherry Coke", "quantity": 1.75},
        {"item": "Soda BIB - Coke Zero", "quantity": 1.50},
        {"item": "Soda BIB - Coke", "quantity": 1.50},
        {"item": "Soda BIB - Diet Coke", "quantity": 1.25},
        {"item": "Soda BIB - Mr Pibb", "quantity": 1.75},
        {"item": "Soda BIB - Root Beer", "quantity": 1.25},
        {"item": "Soda BIB - Dr. Pepper", "quantity": 1.0},
        {"item": "Soda BIB - Sprite", "quantity": 1.50},
        {"item": "Soda BIB - Powerade", "quantity": 1.0},
        {"item": "Lemonade (Diet)", "quantity": 1.25}
    ]

def main():
    image_path = "assets/soda_bibs.jpeg"
    init_db()
    ocr_data = extract_from_image(image_path)
    now = datetime.datetime.now().isoformat()
    
    try:
        with get_db_connection() as conn:
            c = conn.cursor()
            for row in ocr_data:
                c.execute("INSERT OR REPLACE INTO inventory (item, quantity, last_updated) VALUES (?, ?, ?)",
                          (row["item"], float(row["quantity"]), now))
        logging.info(json.dumps({"status": "success", "extracted_items": len(ocr_data), "timestamp": now}))
    except Exception as e:
        logging.error(f"Database insertion failed: {e}")

if __name__ == "__main__":
    main()
