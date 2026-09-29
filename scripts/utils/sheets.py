import os
import logging
try:
    import gspread
    from google.oauth2.service_account import Credentials
    HAS_GSPREAD = True
except ImportError:
    HAS_GSPREAD = False

SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']

def get_sheets_client():
    """
    Initializes and returns an authorized gspread client.
    """
    if not HAS_GSPREAD:
        logging.warning("gspread or google-auth not installed.")
        return None

    creds_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "credentials.json")
    if not os.path.exists(creds_path):
        logging.error(f"Credentials not found at {creds_path}.")
        return None
        
    try:
        credentials = Credentials.from_service_account_file(creds_path, scopes=SCOPES)
        gc = gspread.authorize(credentials)
        return gc
    except Exception as e:
        logging.error(f"Failed to authorize Google Sheets client: {e}")
        return None
