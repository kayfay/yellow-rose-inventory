# RESEARCH: Modern Agentic Inventory Systems for BBQ Operations

## 1. IMS Architecture & BBQ Industry Context
Modern inventory management for independent food and beverage businesses (such as BBQ/sausage operations) is shifting toward autonomous, agentic architectures. The system handles non-deterministic inputs like text messages or unstructured emails and converts them into structured inventory state updates.

### Agentic Workflows
- **Discovery**: Agents proactively ingest multi-modal data streams (emails, OCR images, POS webhooks, and manual spreadsheets).
- **Plan & State**: State is tracked globally and synchronously in a DB (e.g. SQLite), while rules/ratios are maintained separately in declarative formats.
- **Execution**: Changes in state trigger computational tasks (like unit conversion from BIBs to gallons or estimating batch yield losses).
- **Proof & Inquiry**: The system enforces automated proofs before committing to the DB. Unrecognized cases (e.g., missing invoices) cause the agent to prompt the owner.

### BBQ-Specific Operational Needs (Yield Loss & Batch Depletion)
BBQ has complex shrinkage. A raw packer brisket loses significant weight:
- **Raw Weight**: 14-16 lbs
- **Trim Loss**: ~15% (fat removed before smoking)
- **Smoke Shrink**: ~45-50% (moisture/fat rendering during 12+ hour cooks)
- **Net Usable Meat**: Approximately 40-45% of raw weight.
- **Recipe Conversion**: This net weight is then portioned into items like 7 oz brisket sandwiches or 1/2 lb plates. The system must retroactively calculate raw inventory depletion based on POS sales.

## 2. Skeleton-of-Thought (SoT) Architectural Blueprint
**Data Ingestion Engine ➔ Normalized Inventory Database ➔ Yield & Depletion Engine ➔ Real-Time Analytics Dashboard**

1. **Data Ingestion Engine**
   - Stream 1: Google Sheets (Main store inventory spreadsheet)
   - Stream 2: OCR Text Extraction (Images of handwriting, e.g., Soda BIBs via Tesseract/Vision API)
   - Stream 3: Email Order Exports (CSVs of purchase orders)
   - Stream 4: Clover API Automation (Sales & POS depletion)
   - Stream 5: Markdown specs (Pricing and 7 oz portion weights from OPERATIONAL_QUESTIONNAIRE.md)
   
2. **Normalized Inventory Database**
   - SQLite `data/inventory.db`
   - Master item table with unit measurements, PAR thresholds, and reorder points.

3. **Yield & Depletion Engine**
   - Event-driven. When Clover API records a sale (e.g., 100 Pulled Pork Plates), the engine uses the 7 oz portion spec, applies the shrink factor (~50%), and deduces that roughly 1400 oz (87.5 lbs) of raw pork shoulder was depleted.

4. **Real-Time Analytics Dashboard**
   - A dashboard/CLI querying the normalized DB to present current stock levels and alerts for items crossing PAR thresholds.
