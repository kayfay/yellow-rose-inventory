# SYSTEM AUDIT REPORT

**Date:** 2026-09-28
**Scope:** Yellow Rose Inventory Management System (`yellow-rose-inventory`)

## Executive Summary
The Allen.Tools inventory system is functional but suffers from significant technical debt, particularly in the areas of database connection management, code modularity, and error handling. This audit identifies critical vulnerabilities that could lead to database locking, duplicated code, and brittle execution paths.

## Findings by Risk Level

### 🔴 CRITICAL RISK
1. **Unsafe Database Connections:**
   - **Locations:** `calculate_recipe_depletion.py`, `export_to_sheets.py`, `simulate_clover_sales.py`, `extract_soda_bib_ocr.py`, `ingest_inventory_sources.py`
   - **Issue:** Database connections to SQLite (`inventory.db`) are opened without context managers (`with` statements). If an exception occurs before `conn.close()`, the database may remain locked.
   - **Recommendation:** Implement a unified Database Access Layer (DAL) or enforce the use of `with sqlite3.connect(...) as conn:`.

### 🟠 HIGH RISK
1. **Duplicated Google Sheets Authentication:**
   - **Locations:** `check_brisket.py`, `debug_sheets.py`, `fix_blank_rows.py`, `export_to_sheets.py`
   - **Issue:** The OAuth2 credential loading and `gspread` initialization logic is copy-pasted across multiple scripts. This violates DRY principles and makes credential rotation or scope changes highly error-prone.
   - **Recommendation:** Extract Google Sheets initialization into a shared utility module (`scripts/utils/sheets_client.py`).
2. **Missing Error Handling & Guardrails:**
   - **Locations:** System-wide
   - **Issue:** Primary execution routes lack comprehensive `try/except` blocks. Failures in file I/O, API responses, or data parsing will crash the scripts ungracefully.
   - **Recommendation:** Wrap critical execution paths with robust error catching and fallback logging.

### 🟡 MEDIUM RISK (Refactoring Opportunities)
1. **Hardcoded Paths and Constants:**
   - **Locations:** Various scripts
   - **Issue:** File paths (e.g., `credentials.json`, `data/inventory.db`) and IDs are hardcoded.
   - **Recommendation:** Centralize configuration via environment variables or a configuration module.
2. **Data Manipulation Redundancy:**
   - **Issue:** Similar SQL update/insert operations are spread across scripts without a unified interface.

## Proposed Refactoring Blueprint (Skeleton-of-Thought)
1. **Module Creation:** Create a `scripts/utils/` directory.
2. **Database Utility:** Build `scripts/utils/db.py` to handle safe SQLite connections and common queries.
3. **Sheets Utility:** Build `scripts/utils/sheets.py` to handle `gspread` authentication.
4. **Core Script Refactoring:** Rewrite all primary scripts to import from `utils`, enforcing `with` statements and `try/except` logging.
5. **Verification Pipeline:** Author `scripts/verify_system_refactor.py` to statically check for proper context manager usage and run mock queries.
