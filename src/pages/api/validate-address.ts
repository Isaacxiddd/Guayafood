import type { APIRoute } from 'astro';
import { getClientIp, checkRateLimit, checkOrigin } from '../../lib/rate-limit';
import { validateCabaAddress } from '../../lib/address';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!checkOrigin(request)) {
    return new Response(JSON.stringify({ error: 'Origen no permitido' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const ip = getClientIp(request);
  const rate = checkRateLimit(ip);
  if (!rate.allowed) {
    return new Response(JSON.stringify({ error: 'Demasiadas solicitudes. Intentalo de nuevo en unos segundos.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': String(Math.ceil(rate.resetIn / 1000)) },
    });
  }

  let body: { address?: string; barrio?: string };

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const address = (body.address || '').trim();
  if (!address) {
    return new Response(JSON.stringify({ error: 'Falta la dirección' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const barrio = body.barrio || '';
  const result = await validateCabaAddress(address, barrio);

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
