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
      if (payload.passcode !== env.EXPECTED_PASSCODE) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      // 3. Get Google OAuth Token
      const token = await getGoogleAuthToken(env.GOOGLE_CLIENT_EMAIL, env.GOOGLE_PRIVATE_KEY);
      
      const sheetId = env.GOOGLE_SHEET_ID;
      const sheetName = env.GOOGLE_SHEET_NAME || 'Inventory';

      // 4. Handle Actions
      if (payload.action === 'read') {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.error) throw new Error(data.error.message);
        
        const headers = data.values[0];
        const items = data.values.slice(1).map(row => {
          let obj = {};
          headers.forEach((h, i) => obj[h] = row[i]);
          return obj;
        });

        return new Response(JSON.stringify({ items }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      if (payload.action === 'update' && payload.updates) {
        // First, fetch headers to find columns
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}!1:1`;
        const resH = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const dataH = await resH.json();
        const headers = dataH.values[0];
        
        const idCol = headers.indexOf('ItemID');
        const ohCol = headers.indexOf('OH');
        const tsCol = headers.indexOf('Timestamp');

        // Fetch all ItemIDs to find row numbers
        const urlId = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}!${String.fromCharCode(65 + idCol)}:${String.fromCharCode(65 + idCol)}`;
        const resId = await fetch(urlId, { headers: { Authorization: `Bearer ${token}` } });
        const dataId = await resId.json();
        const allIds = dataId.values.map(r => r[0]);

        const updateData = [];
        
        payload.updates.forEach(u => {
          const rowIndex = allIds.indexOf(String(u.ItemID));
          if (rowIndex > 0) { // +1 for 1-based, +1 again because indexOf is 0-based but row 1 is headers. Actually rowIndex is the 0-based array index, which is the exact row number if 1-based.
            const rowNumber = rowIndex + 1;
            
            // Push OH Update
            updateData.push({
              range: `${sheetName}!${String.fromCharCode(65 + ohCol)}${rowNumber}`,
              values: [[u.OH_Quantity]]
            });
            
            // Push Timestamp Update if exists
            if (tsCol !== -1) {
              updateData.push({
                range: `${sheetName}!${String.fromCharCode(65 + tsCol)}${rowNumber}`,
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
          if(batchResult.error) throw new Error(batchResult.error.message);
        }

        return new Response(JSON.stringify({ success: true, updated: updateData.length }), {
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

  const key = await importPKCS8(privateKey, 'RS256');
  
  const jwt = await new SignJWT({
    iss: clientEmail,
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
