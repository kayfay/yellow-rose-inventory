import { SignJWT, importPKCS8 } from 'jose';

export default {
  async fetch(request, env) {
    // 1. CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    if (request.method !== 'POST') {
      return new Response('Only POST allowed', { status: 405 });
    }

    try {
      const payload = await request.json();
      
      // 2. Validate Passcode
      const expectedPass = (env.EXPECTED_PASSCODE || '').trim();
      const userPass = (payload.passcode || '').trim();
      if (!expectedPass || userPass !== expectedPass) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      // 3. Get Google OAuth Token
      const token = await getGoogleAuthToken(env.GOOGLE_CLIENT_EMAIL, env.GOOGLE_PRIVATE_KEY);
      
      const sheetId = (env.GOOGLE_SHEET_ID || '').trim();

      // Automatically find the sheet/tab name
      async function resolveSheetName() {
        if (env.GOOGLE_SHEET_NAME && env.GOOGLE_SHEET_NAME.trim()) {
          return env.GOOGLE_SHEET_NAME.trim();
        }
        try {
          const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`;
          const metaRes = await fetch(metaUrl, { headers: { Authorization: `Bearer ${token}` } });
          const metaData = await metaRes.json();
          if (metaData.error) throw new Error(metaData.error.message);
          const titles = (metaData.sheets || []).map(s => s.properties.title);
          // Prefer 'Inventory' if it exists, otherwise use the very first tab
          const invMatch = titles.find(t => t.toLowerCase() === 'inventory');
          return invMatch || titles[0] || 'Sheet1';
        } catch (e) {
          return 'Sheet1';
        }
      }

      const sheetName = await resolveSheetName();
      const escapedSheet = `'${sheetName.replace(/'/g, "''")}'`;

      // Helper for column letters (handles A-Z, AA, AB, etc.)
      function getColLetter(index) {
        let col = '', temp;
        while (index >= 0) {
          temp = index % 26;
          col = String.fromCharCode(temp + 65) + col;
          index = Math.floor(index / 26) - 1;
        }
        return col;
      }

      // 4. Handle Actions
      if (payload.action === 'read') {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(escapedSheet)}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.error) throw new Error(data.error.message);
        
        const rows = data.values || [];
        if (rows.length === 0) {
          return new Response(JSON.stringify({ items: [] }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        const headers = rows[0];
        const items = rows.slice(1).map((row, idx) => {
          let obj = { _row: idx + 2 };
          headers.forEach((h, i) => obj[h] = row[i] !== undefined ? row[i] : '');
          return obj;
        });

        return new Response(JSON.stringify({ items, sheetName }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      if (payload.action === 'update' && payload.updates) {
        // First, fetch headers to find columns
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(escapedSheet + '!1:1')}`;
        const resH = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const dataH = await resH.json();
        const headers = dataH.values[0];
        
        let idCol = headers.findIndex(h => /^(itemid|item id|item #|id|code|sku)$/i.test((h || '').trim()));
        let nameCol = headers.findIndex(h => /^(item|item name|product|description|name)$/i.test((h || '').trim()));
        let ohCol = headers.findIndex(h => /^(oh|on hand|on-hand|current stock|qty|quantity)$/i.test((h || '').trim()));
        let tsCol = headers.findIndex(h => /^(timestamp|last updated)$/i.test((h || '').trim()));

        if (idCol === -1 && nameCol !== -1) idCol = nameCol;
        if (idCol === -1) idCol = 0;
        
        // Strict Sheet Protection: Reject if OH column cannot be resolved by exact header match
        if (ohCol === -1) {
          return new Response(JSON.stringify({ error: "Sheet Protection: OH column header not found." }), {
            status: 422, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        const idColLetter = getColLetter(idCol);

        // Fetch all ItemIDs/names to verify row alignment
        const urlId = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(escapedSheet + '!' + idColLetter + ':' + idColLetter)}`;
        const resId = await fetch(urlId, { headers: { Authorization: `Bearer ${token}` } });
        const dataId = await resId.json();
        const allIds = (dataId.values || []).map(r => (r && r[0] !== undefined) ? String(r[0]).trim() : '');

        const updateData = [];
        const ohColLetter = getColLetter(ohCol);
        const tsColLetter = tsCol !== -1 ? getColLetter(tsCol) : null;
        
        payload.updates.forEach(u => {
          const targetId = String(u.ItemID || '').trim().toLowerCase();
          const targetRow = parseInt(u._row, 10);
          let rowIndex = -1;

          // If valid targetRow provided, verify that the item name at that row matches to prevent duplicate-name collisions
          if (targetRow && targetRow >= 2 && targetRow <= allIds.length) {
            const actualName = (allIds[targetRow - 1] || '').toLowerCase();
            if (actualName === targetId || !targetId) {
              rowIndex = targetRow - 1;
            }
          }

          // Fallback to name search only if row validation didn't match
          if (rowIndex === -1 && targetId) {
            rowIndex = allIds.findIndex((val, i) => i > 0 && val.toLowerCase() === targetId);
          }

          if (rowIndex > 0) {
            const rowNumber = rowIndex + 1;
            const numericOH = Number(u.OH_Quantity);
            const safeOH = (!isNaN(numericOH) && numericOH >= 0) ? numericOH : 0;
            
            // Push OH Update (Strict single-cell update)
            updateData.push({
              range: `${escapedSheet}!${ohColLetter}${rowNumber}`,
              values: [[safeOH]]
            });
            
            // Push Timestamp Update if column exists in sheet
            if (tsColLetter) {
              updateData.push({
                range: `${escapedSheet}!${tsColLetter}${rowNumber}`,
                values: [[u.Timestamp]]
              });
            }
          }
        });

        if (updateData.length > 0) {
          const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`;
          const batchRes = await fetch(batchUrl, {
            method: 'POST',
            headers: { 
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              valueInputOption: 'USER_ENTERED',
              data: updateData
            })
          });
          const batchResult = await batchRes.json();
          if (batchResult.error) throw new Error(batchResult.error.message);
        }

        return new Response(JSON.stringify({ success: true, updated: updateData.length, sheetName }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      // 5. Handle 'scan_shelf' action (Multimodal Walk-in AI Vision)
      if (payload.action === 'scan_shelf') {
        const geminiApiKey = (env.GEMINI_API_KEY || '').trim();
        if (!geminiApiKey) {
          return new Response(JSON.stringify({ 
            error: 'GEMINI_API_KEY is not configured in Cloudflare Worker secrets. Run: npx wrangler secret put GEMINI_API_KEY' 
          }), {
            status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        let base64Image = payload.image || '';
        // Strip data:image/...;base64, prefix if included
        const commaIdx = base64Image.indexOf(',');
        if (commaIdx !== -1) {
          base64Image = base64Image.substring(commaIdx + 1);
        }

        if (!base64Image) {
          return new Response(JSON.stringify({ error: 'No image data provided.' }), {
            status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          });
        }

        const knownItemsList = Array.isArray(payload.knownItems) ? payload.knownItems.join(', ') : 'Whole Brisket, Pork Butts, Pork Rib Racks, Sausage Links, Dino Ribs, Creamer, Cream Cheese, Turkey, Bacon, Sausage Casing';

        const prompt = `You are an expert commercial barbecue smokehouse kitchen inventory auditor for Yellow Rose BBQ.
Analyze this photo of a walk-in cooler shelf, dry storage, or warmer shelf and count the items.

CRITICAL KITCHEN PACKAGING RULES:
1. PORK RIBS: Unpackaged from shipping boxes and stored in individual sealed Cryovac bags with EXACTLY 2 rib racks per bag. If you count N cryo bags of ribs, countCases=0, countLoose=(N * 2).
2. WHOLE BRISKET & PORK BUTTS: Stored unboxed in individual vacuum-sealed Cryovac plastic bags directly on wire shelving. Each bag is 1 loose unit (countCases=0, countLoose=N).
3. BOXED / DRY / DAIRY GOODS:
   - Cardboard boxed coffee creamers (boxes/cases or loose cartons)
   - Cream cheese blocks in individual wrapped boxes/cartons
   - Boxed turkey breasts (cases or individual breasts)
   - Box of bacon (cases or packages)
   - Box or bag of hog sausage casings
4. WARMER SHELF PANS:
   - Aluminum-wrapped parcels (Whole Brisket, Pork Butts, Dino Ribs, Pork Rib Racks)
   - Metal/aluminum sheet pans of sausage links or rosebuds

KNOWN INVENTORY ITEMS:
${knownItemsList}

Identify each visible item, count them carefully, and determine whether they are in cases or loose units.
Respond ONLY with a valid JSON object matching this exact schema:
{
  "summary": "Brief explanation of what was seen on the shelf",
  "detections": [
    {
      "matchedItemName": "Name matching known inventory item if applicable",
      "countCases": 0,
      "countLoose": 0,
      "unit": "racks, bags, boxes, or parcels",
      "confidence": "high" | "medium" | "low",
      "notes": "e.g. 3 cryo bags counted = 6 rib racks"
    }
  ],
  "unmatchedLabels": ["Any visible handwritten labels, tags, or uncataloged boxes"]
}`;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType: 'image/jpeg',
                      data: base64Image
                    }
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json'
            }
          })
        });

        const geminiData = await geminiRes.json();
        if (geminiData.error) {
          throw new Error(`Gemini API Error: ${geminiData.error.message || JSON.stringify(geminiData.error)}`);
        }

        const candidateText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!candidateText) {
          throw new Error('No response generated by Gemini Vision model.');
        }

        let parsedResult;
        try {
          parsedResult = JSON.parse(candidateText);
        } catch(e) {
          parsedResult = {
            summary: candidateText,
            detections: [],
            unmatchedLabels: []
          };
        }

        return new Response(JSON.stringify({ 
          success: true, 
          result: parsedResult 
        }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      throw new Error('Invalid action');

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }
};

async function getGoogleAuthToken(clientEmail, privateKey) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;

  const formattedKey = (privateKey || '').replace(/\\n/g, '\n').trim();
  const email = (clientEmail || '').trim();

  const key = await importPKCS8(formattedKey, 'RS256');
  
  const jwt = await new SignJWT({
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp,
    iat
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .sign(key);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error_description);
  
  return data.access_token;
}
