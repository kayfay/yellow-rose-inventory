import sqlite3
from contextlib import contextmanager
import os
import logging

DB_PATH = os.environ.get("INVENTORY_DB_PATH", "data/inventory.db")

@contextmanager
def get_db_connection(db_path=DB_PATH):
    """
    Context manager for safe database connections.
    Ensures connection is closed even if exceptions occur.
    """
    conn = sqlite3.connect(db_path)
    try:
        yield conn
        conn.commit()
    except Exception as e:
        logging.error(f"Database transaction failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()
