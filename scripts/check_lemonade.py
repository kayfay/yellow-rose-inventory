import os
import gspread
from google.oauth2.service_account import Credentials

SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
creds_path = "credentials.json"
credentials = Credentials.from_service_account_file(creds_path, scopes=SCOPES)
gc = gspread.authorize(credentials)
sh = gc.open_by_key("1knWAQH74RoeR5U92IHVyToneF2rcnaybmtnrAoBRu3o")
ws = sh.sheet1
data = ws.get_all_values()

for i, row in enumerate(data):
    item = row[0].lower() if len(row) > 0 else ""
    if "lemonade" in item or "minute maid" in item:
        print(f"Row {i+1}: {row}")
