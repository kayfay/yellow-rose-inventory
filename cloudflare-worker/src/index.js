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
        const items = rows.slice(1).map(row => {
          let obj = {};
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
        
        const idCol = headers.indexOf('ItemID');
        const ohCol = headers.indexOf('OH');
        const tsCol = headers.indexOf('Timestamp');

        if (idCol === -1 || ohCol === -1) {
          throw new Error("Missing required columns 'ItemID' or 'OH' in sheet.");
        }

        const idColLetter = getColLetter(idCol);

        // Fetch all ItemIDs to find row numbers
        const urlId = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(escapedSheet + '!' + idColLetter + ':' + idColLetter)}`;
        const resId = await fetch(urlId, { headers: { Authorization: `Bearer ${token}` } });
        const dataId = await resId.json();
        const allIds = (dataId.values || []).map(r => r ? r[0] : '');

        const updateData = [];
        const ohColLetter = getColLetter(ohCol);
        const tsColLetter = tsCol !== -1 ? getColLetter(tsCol) : null;
        
        payload.updates.forEach(u => {
          const rowIndex = allIds.indexOf(String(u.ItemID));
          if (rowIndex > 0) {
            const rowNumber = rowIndex + 1;
            
            // Push OH Update
            updateData.push({
              range: `${escapedSheet}!${ohColLetter}${rowNumber}`,
              values: [[u.OH_Quantity]]
            });
            
            // Push Timestamp Update if exists
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
