import type { IncomingMessage, ServerResponse } from 'node:http';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const MAX_BODY_SIZE = 100_000;

function sanitizeSheetValue(value: string): string {
  if (typeof value !== 'string') return value;
  if (/^[=+\-@]/.test(value)) return `'${value}`;
  return value;
}

function getAuth() {
  const base64 = process.env.GOOGLE_CREDENTIALS_BASE64;
  if (!base64) return null;
  try {
    const creds = JSON.parse(Buffer.from(base64, 'base64').toString());
    return new JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
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

  let body: {
    preferenceId: string;
    status: string;
    name: string;
    phone: string;
    address: string;
    reference?: string;
    items: { title: string; quantity: number }[];
    total: number;
    notes?: string;
    deliveryDate?: string;
    deliveryTime?: string;
  };

  try {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    for await (const chunk of req) {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_SIZE) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Request body too large' }));
        return;
      }
      chunks.push(chunk);
    }
    body = JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
    return;
  }

  if (!body.preferenceId || !body.name || !body.address) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing required fields' }));
    return;
  }

  try {
    const auth = getAuth();
    const sheetId = getSheetId();

    if (auth && sheetId) {
      const doc = new GoogleSpreadsheet(sheetId, auth);
      await doc.loadInfo();

      let sheet = doc.sheetsByTitle['Pedidos'];
      if (!sheet) {
        sheet = await doc.addSheet({ title: 'Pedidos' });
      }

      const headers = [
        'Fecha', 'Preference ID', 'Estado', 'Nombre', 'Teléfono',
        'Dirección', 'Referencia', 'Productos', 'Total', 'Notas',
        'Fecha de entrega', 'Horario',
      ];

      if (!sheet.headerValues || sheet.headerValues.length === 0) {
        await sheet.setHeaderRow(headers);
      }

      const existingHeaders = sheet.headerValues || [];
      const missingHeaders = headers.filter((h) => !existingHeaders.includes(h));
      if (missingHeaders.length > 0) {
        await sheet.setHeaderRow(headers);
      }

      await sheet.addRow({
        Fecha: new Date().toISOString(),
        'Preference ID': body.preferenceId,
        Estado: body.status,
        Nombre: sanitizeSheetValue(body.name),
        Teléfono: sanitizeSheetValue(body.phone),
        Dirección: sanitizeSheetValue(body.address),
        Referencia: sanitizeSheetValue(body.reference || ''),
        Productos: body.items.map((i) => `${sanitizeSheetValue(i.title)} x${i.quantity}`).join(', '),
        Total: `$${body.total.toLocaleString('es-AR')}`,
        Notas: sanitizeSheetValue(body.notes || ''),
        'Fecha de entrega': body.deliveryDate || '',
        Horario: body.deliveryTime || '',
      });
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  } catch (error) {
    console.error('Save order error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Error al guardar el pedido' }));
  }
}
