/**
 * Sausage Tools Inventory - Google Apps Script Backend
 * 
 * INSTRUCTIONS:
 * 1. Open your Google Sheet.
 * 2. Click Extensions > Apps Script.
 * 3. Delete any existing code and paste this entire file.
 * 4. Change the EXPECTED_PASSCODE variable below to your secret password.
 * 5. Click Deploy > New Deployment.
 * 6. Select type: "Web app".
 * 7. Execute as: "Me" (your email).
 * 8. Who has access: "Anyone" (Security is handled by the passcode).
 * 9. Copy the Web App URL and paste it into the SPA Config Modal.
 */

const EXPECTED_PASSCODE = "REPLACE_ME_IN_YOUR_SHEET"; // <--- CHANGE THIS IN YOUR SHEET!
const SHEET_NAME = "Inventory"; // Change if your sheet name is different

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    
    // 1. Authenticate Request
    if (payload.passcode !== EXPECTED_PASSCODE) {
      return ContentService.createTextOutput(JSON.stringify({ error: "Unauthorized. Invalid passcode." }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error("Sheet not found: " + SHEET_NAME);
    
    // 2. Handle 'read' action
    if (payload.action === 'read') {
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const items = [];
      
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const item = {};
        for (let j = 0; j < headers.length; j++) {
          item[headers[j]] = row[j];
        }
        items.push(item);
      }
      
      return ContentService.createTextOutput(JSON.stringify({ items: items }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 3. Handle 'update' action (CRITICAL: Only update OH and Timestamp)
    if (payload.action === 'update' && payload.updates) {
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      
      const idIndex = headers.indexOf('ItemID');
      const ohIndex = headers.indexOf('OH');
      const timestampIndex = headers.indexOf('Timestamp'); // Ensure you have a Timestamp column!
      
      if (idIndex === -1 || ohIndex === -1) {
        throw new Error("Missing required columns: ItemID or OH");
      }
      
      let updatedCount = 0;
      
      // Map updates by ItemID for quick lookup
      const updateMap = {};
      payload.updates.forEach(u => updateMap[u.ItemID] = u);
      
      // Update sheet rows
      for (let i = 1; i < data.length; i++) {
        const rowId = String(data[i][idIndex]);
        if (updateMap[rowId]) {
          // Write OH
          sheet.getRange(i + 1, ohIndex + 1).setValue(updateMap[rowId].OH_Quantity);
          // Write Timestamp if column exists
          if (timestampIndex !== -1) {
            sheet.getRange(i + 1, timestampIndex + 1).setValue(updateMap[rowId].Timestamp);
          }
          updatedCount++;
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({ success: true, updated: updatedCount }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    throw new Error("Invalid action specified.");
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Add dummy doGet to prevent script errors when accessed directly
function doGet(e) {
  return ContentService.createTextOutput("Sausage Tools API. Use POST.");
}
