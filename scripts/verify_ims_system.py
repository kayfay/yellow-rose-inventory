import sys
import logging
from utils.db import get_db_connection

logging.basicConfig(level=logging.INFO)

def verify():
    try:
        with get_db_connection() as conn:
            c = conn.cursor()
            
            # 1. Verify OCR Extraction
            c.execute("SELECT quantity FROM inventory WHERE item = 'Soda BIB - Cherry Coke'")
            row = c.fetchone()
            assert row is not None, "OCR Extraction Failed: Cherry Coke not found"
            assert row[0] == 1.75, f"OCR Extraction Failed: Expected 1.75, got {row[0]}"
            
            # 2. Verify Multi-Stream Ingestion
            c.execute("SELECT quantity FROM inventory WHERE item = 'Brisket (Raw)'")
            row = c.fetchone()
            assert row is not None, "Ingestion Failed: Brisket not found"
            
            # 3. Verify Yield Depletion Math
            c.execute("SELECT quantity FROM inventory WHERE item = 'Pork Butt (Raw)'")
            row = c.fetchone()
            assert row is not None, "Depletion Failed: Pork Butt not found"
            
            expected = 100.0 - (100 * (7.0 / 16.0) / 0.55)
            assert abs(row[0] - expected) < 0.01, f"Depletion Failed: Expected ~{expected:.2f}, got {row[0]}"
            
            logging.info("Verification Passed: All assertions successful.")
            sys.exit(0)
    except AssertionError as e:
        logging.error(f"Verification Failed: {e}")
        sys.exit(1)
    except Exception as e:
        logging.error(f"Unexpected error during verification: {e}")
        sys.exit(1)

if __name__ == "__main__":
    verify()
