import type { APIRoute } from 'astro';
import { checkOrigin } from '../../lib/rate-limit';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!checkOrigin(request)) {
    return new Response(JSON.stringify({ error: 'Origen no permitido' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { payment_id?: string; preference_id?: string };

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ verified: false, error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const paymentId = body.payment_id;
  const preferenceId = body.preference_id;
  if (!paymentId) {
    return new Response(JSON.stringify({ verified: false, error: 'Missing payment_id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    return new Response(JSON.stringify({ verified: false, error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return new Response(JSON.stringify({ verified: false, status: 'not_found' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();
    const verified = data.status === 'approved';

    let orderData = null;
    if (verified && preferenceId) {
      try {
        const prefController = new AbortController();
        const prefTimeoutId = setTimeout(() => prefController.abort(), 8000);
        const prefRes = await fetch(`https://api.mercadopago.com/checkout/preferences/${preferenceId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: prefController.signal,
        });
        clearTimeout(prefTimeoutId);
        if (prefRes.ok) {
          const pref = await prefRes.json();
          const m = pref.metadata;
          if (m) {
            const PRODUCT_CATALOG: Record<string, { name: string; unitPrice: number }> = {
              empanaditas: { name: 'Empanaditas venezolanas', unitPrice: 1500 },
              tequenos: { name: 'Tequeños irresistibles', unitPrice: 1000 },
              pastelitos: { name: 'Pastelitos andinos', unitPrice: 1800 },
              'combo-a': { name: 'Combo A', unitPrice: 10000 },
              'combo-b': { name: 'Combo B', unitPrice: 14500 },
              'combo-c': { name: 'Combo C', unitPrice: 18000 },
            };
            orderData = {
              name: m.customer_name,
              phone: m.customer_phone,
              address: m.customer_address,
              barrio: m.customer_barrio || '',
              reference: m.customer_reference || '',
              notes: m.notes || '',
              deliveryDate: m.delivery_date || '',
              deliveryTime: m.delivery_time || '',
              items: m.items ? m.items.split(',').map((s: string) => {
                const [productId, quantity] = s.split('|');
                const product = PRODUCT_CATALOG[productId] || { name: productId, unitPrice: 0 };
                return { title: product.name, quantity: parseInt(quantity), unitPrice: product.unitPrice };
              }) : [],
              total: m.total || 0,
            };
          }
        }
      } catch { /* order data unavailable, continue */ }
    }

    return new Response(JSON.stringify({
      verified,
      status: data.status,
      external_reference: data.external_reference,
      payer_email: data.payer?.email,
      transaction_amount: data.transaction_amount,
      orderData,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ verified: false, error: 'Error verifying payment' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
