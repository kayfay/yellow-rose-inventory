import os
import sys
import subprocess

def run_tests():
    print("--- Tier 1: Syntax & Import Checks ---")
    scripts_dir = "scripts"
    files_to_check = [
        "utils/db.py", "utils/sheets.py",
        "calculate_recipe_depletion.py", "check_brisket.py",
        "debug_sheets.py", "export_to_sheets.py",
        "extract_soda_bib_ocr.py", "fix_blank_rows.py",
        "ingest_inventory_sources.py", "simulate_clover_sales.py",
        "verify_ims_system.py"
    ]
    
    for f in files_to_check:
        filepath = os.path.join(scripts_dir, f)
        result = subprocess.run([sys.executable, "-m", "py_compile", filepath], capture_output=True, text=True)
        if result.returncode != 0:
            print(f"Syntax Error in {f}: {result.stderr}")
            sys.exit(1)
        print(f"[x] Syntax check passed: {f}")

    print("\n--- Tier 2: Functional Execution & Regression Safety ---")
    
    # Check that database connection context manager works
    from scripts.utils.db import get_db_connection
    try:
        with get_db_connection() as conn:
            c = conn.cursor()
            c.execute("SELECT 1")
        print("[x] DB Context Manager functional.")
    except Exception as e:
        print(f"DB Context Manager failed: {e}")
        sys.exit(1)
        
    # Test verify_ims_system.py as a regression test
    print("\nRunning legacy verification script to ensure regression safety...")
    result = subprocess.run([sys.executable, "scripts/verify_ims_system.py"], capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Regression Test Failed:\n{result.stdout}\n{result.stderr}")
        sys.exit(1)
    print(f"[x] Regression tests passed:\n{result.stdout.strip()}")

    print("\nALL SYSTEM REFACTOR VERIFICATION CHECKS PASSED. EXIT CODE 0.")
    sys.exit(0)

if __name__ == "__main__":
    run_tests()
