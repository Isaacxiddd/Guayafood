import type { APIRoute } from 'astro';
import { getClientIp, checkRateLimit } from '../../lib/rate-limit';

export const prerender = false;

const CABA_BARRIOS = [
  'capital federal', 'caba', 'buenos aires', 'ciudad autonoma de buenos aires',
  'agronomía', 'almagro', 'balvanera', 'barracas', 'belgrano', 'boedo',
  'caballito', 'chacarita', 'colegiales', 'constitución', 'flores', 'floresta',
  'la boca', 'la paternal', 'liniers', 'mataderos', 'monte castro', 'montserrat',
  'nueva pompeya', 'nuñez', 'palermo', 'parque avellaneda', 'parque chacabuco',
  'parque patricios', 'puerto madero', 'recoleta', 'retiro', 'saavedra',
  'san cristóbal', 'san nicolás', 'san telmo', 'versalles', 'villa crespo',
  'villa del parque', 'villa devoto', 'villa general mitre', 'villa lugano',
  'villa luro', 'villa ortúzar', 'villa pueyrredón', 'villa real',
  'villa riachuelo', 'villa santa rita', 'villa soldati', 'villa urquiza',
  'villa de mayo', 'coghlan', 'palermo viejo', 'palermo soho', 'palermo hollywood',
  'las cañitas', 'abasto', 'once', 'congreso', 'tribunales', 'microcentro',
  'barrio norte', 'barrio sur',
];

function extractPostalCode(address: string): string | null {
  const match = address.match(/\bC\d{4}\b/);
  return match ? match[0] : null;
}

function keywordCheck(address: string): boolean {
  const lower = address.toLowerCase();
  return CABA_BARRIOS.some((b) => lower.includes(b));
}

function zipCodeCheck(address: string): boolean {
  const cp = extractPostalCode(address);
  if (!cp) return false;
  const num = parseInt(cp.slice(1), 10);
  return num >= 1000 && num <= 1999;
}

async function nominatimCheck(address: string): Promise<{ isCaba: boolean; confidence: string } | null> {
  try {
    const encoded = encodeURIComponent(`${address}, Buenos Aires, Argentina`);
    const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&addressdetails=1&limit=1`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Guayafood/1.0 (https://guayafood.vercel.app)' },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.length) return null;
    const state = (data[0].address?.state || '').toLowerCase();
    const city = (data[0].address?.city || '').toLowerCase();
    const isCaba = state.includes('ciudad autónoma de buenos aires')
      || state.includes('buenos aires')
      || city.includes('caba')
      || city.includes('capital federal')
      || city.includes('ciudad autónoma');
    return { isCaba, confidence: isCaba ? 'alta' : 'baja' };
  } catch {
    return null;
  }
}

export const POST: APIRoute = async ({ request }) => {
  const ip = getClientIp(request);
  const rate = checkRateLimit(ip);
  if (!rate.allowed) {
    return new Response(JSON.stringify({ error: 'Demasiadas solicitudes. Intentalo de nuevo en unos segundos.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': String(Math.ceil(rate.resetIn / 1000)) },
    });
  }

  let body: { address?: string };

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

  if (keywordCheck(address)) {
    return new Response(JSON.stringify({ isCaba: true, method: 'keyword', confidence: 'alta' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (zipCodeCheck(address)) {
    return new Response(JSON.stringify({ isCaba: true, method: 'zipcode', confidence: 'alta' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const osmResult = await nominatimCheck(address);

  if (osmResult) {
    return new Response(JSON.stringify({
      isCaba: osmResult.isCaba,
      method: 'osm',
      confidence: osmResult.confidence,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    isCaba: true,
    method: 'fallback',
    confidence: 'baja',
    warning: 'No se pudo verificar automáticamente. Confirmá que sea CABA.',
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
