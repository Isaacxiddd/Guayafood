import type { IncomingMessage, ServerResponse } from 'node:http';
import { checkRateLimit } from './lib/rate-limit';

const MAX_BODY_SIZE = 10_000;

function getClientIp(req: IncomingMessage): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
}

function extractPostalCode(address: string): string | null {
  const match = address.match(/\bC\d{4}\b/);
  return match ? match[0] : null;
}

function keywordCheck(address: string): boolean {
  const lower = address.toLowerCase();
  const keywords = [
    'capital federal', 'caba', 'buenos aires',
    'ciudad autonoma de buenos aires',
  ];
  return keywords.some((kw) => lower.includes(kw));
}

function zipCodeCheck(address: string): boolean {
  const cp = extractPostalCode(address);
  if (!cp) return false;
  const num = parseInt(cp.slice(1), 10);
  return num >= 1000 && num <= 1999;
}

async function georefCheck(address: string): Promise<{ isCaba: boolean; confidence: string } | null> {
  try {
    const encoded = encodeURIComponent(address);
    const url = `https://apis.gob.ar/georef/api/direcciones?direccion=${encoded}&provincia=Ciudad Aut%C3%B3noma de Buenos Aires&max_resultados=1`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    const cantResultados = data.cantidad || 0;
    if (cantResultados > 0) {
      return { isCaba: true, confidence: 'alta' };
    }
    return { isCaba: false, confidence: 'baja' };
  } catch {
    return null;
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const ip = getClientIp(req);
  const rate = checkRateLimit(ip);
  if (!rate.allowed) {
    res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': String(Math.ceil(rate.resetIn / 1000)) });
    res.end(JSON.stringify({ error: 'Demasiadas solicitudes. Intentalo de nuevo en unos segundos.' }));
    return;
  }

  let body: { address?: string };

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

  const address = (body.address || '').trim();
  if (!address) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Falta la dirección' }));
    return;
  }

  // Fast path: keyword match
  if (keywordCheck(address)) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ isCaba: true, method: 'keyword', confidence: 'alta' }));
    return;
  }

  // Fast path: zip code match
  if (zipCodeCheck(address)) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ isCaba: true, method: 'zipcode', confidence: 'alta' }));
    return;
  }

  // API lookup via Georef
  const georefResult = await georefCheck(address);

  if (georefResult) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      isCaba: georefResult.isCaba,
      method: 'georef',
      confidence: georefResult.confidence,
    }));
    return;
  }

  // Fallback: if API timed out or errored, be lenient
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    isCaba: true,
    method: 'fallback',
    confidence: 'baja',
    warning: 'No se pudo verificar automáticamente. Confirmá que sea CABA.',
  }));
}
