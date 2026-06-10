import type { IncomingMessage, ServerResponse } from 'node:http';
import { GoogleSpreadsheet } from 'google-spreadsheet';

const MAX_ORDERS_PER_SLOT = parseInt(process.env.PUBLIC_MAX_ORDERS_PER_SLOT || '3', 10);

function getCredentials() {
  const base64 = process.env.GOOGLE_CREDENTIALS_BASE64;
  if (!base64) return null;
  try {
    return JSON.parse(Buffer.from(base64, 'base64').toString());
  } catch {
    return null;
  }
}

function getSheetId() {
  return process.env.GOOGLE_SHEET_ID || '';
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  let body: { date?: string; time?: string };

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk);
    body = JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
    return;
  }

  if (!body.date || !body.time) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing date or time' }));
    return;
  }

  const creds = getCredentials();
  const sheetId = getSheetId();

  if (!creds || !sheetId) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ available: true, currentCount: 0, maxSlots: MAX_ORDERS_PER_SLOT }));
    return;
  }

  try {
    const doc = new GoogleSpreadsheet(sheetId);
    await doc.useServiceAccountAuth(creds);
    await doc.loadInfo();

    const sheet = doc.sheetsByTitle['Pedidos'];
    if (!sheet) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ available: true, currentCount: 0, maxSlots: MAX_ORDERS_PER_SLOT }));
      return;
    }

    const rows = await sheet.getRows();
    const dateCol = 'Fecha de entrega';
    const timeCol = 'Horario';

    const hasDateCol = sheet.headerValues?.includes(dateCol);
    const hasTimeCol = sheet.headerValues?.includes(timeCol);

    if (!hasDateCol || !hasTimeCol) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ available: true, currentCount: 0, maxSlots: MAX_ORDERS_PER_SLOT }));
      return;
    }

    const count = rows.filter((r) => {
      const rowDate = r.get(dateCol);
      const rowTime = r.get(timeCol);
      return rowDate === body.date && rowTime === body.time;
    }).length;

    const available = count < MAX_ORDERS_PER_SLOT;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      available,
      currentCount: count,
      maxSlots: MAX_ORDERS_PER_SLOT,
      message: available
        ? `Disponible (${count}/${MAX_ORDERS_PER_SLOT} reservas)`
        : `Este horario ya está completo (${count}/${MAX_ORDERS_PER_SLOT}). Elegí otro.`,
    }));
  } catch (error) {
    console.error('Check availability error:', error);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ available: true, currentCount: 0, maxSlots: MAX_ORDERS_PER_SLOT }));
  }
}
