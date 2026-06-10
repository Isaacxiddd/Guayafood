import { MercadoPagoConfig, Preference } from 'mercadopago';
import type { IncomingMessage, ServerResponse } from 'node:http';

interface PreferenceBody {
  title: string;
  unitPrice: number;
  quantity?: number;
  description?: string;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing MERCADOPAGO_ACCESS_TOKEN' }));
    return;
  }

  const siteUrl = process.env.PUBLIC_SITE_URL || 'https://guayafood.vercel.app';

  let body: PreferenceBody;
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk);
    body = JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
    return;
  }

  const { title, unitPrice, quantity, description } = body;

  if (!title || typeof unitPrice !== 'number' || unitPrice <= 0) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing or invalid title/unitPrice' }));
    return;
  }

  try {
    const client = new MercadoPagoConfig({ accessToken });
    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: [
          {
            title,
            quantity: quantity || 1,
            unit_price: unitPrice,
            currency_id: 'ARS',
            description: description || '',
          },
        ],
        back_urls: {
          success: `${siteUrl}/`,
          failure: `${siteUrl}/`,
          pending: `${siteUrl}/`,
        },
        auto_return: 'approved',
      },
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      preference_id: result.id,
      init_point: result.init_point,
    }));
  } catch (error) {
    console.error('Mercado Pago error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to create preference' }));
  }
}
