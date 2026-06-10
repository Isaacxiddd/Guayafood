import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  let body: { payment_id?: string };

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ verified: false, error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const paymentId = body.payment_id;
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

    return new Response(JSON.stringify({
      verified: data.status === 'approved',
      status: data.status,
      external_reference: data.external_reference,
      payer_email: data.payer?.email,
      transaction_amount: data.transaction_amount,
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
