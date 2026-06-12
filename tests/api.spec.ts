import { test, expect } from '@playwright/test';

// Each describe block uses a unique IP so parallel runs don't share the rate limit bucket.
// In dev mode x-real-ip is not set, so X-Forwarded-For is used by getClientIp.
function headers(ip: string) {
  return { Origin: 'http://localhost:4321', 'X-Forwarded-For': ip };
}

test.describe('API /validate-address', () => {

  test('barrio CABA conocido retorna isCaba: true', async ({ request }) => {
    const res = await request.post('/api/validate-address', {
      headers: headers('10.1.0.1'),
      data: { address: 'Av. Corrientes 1234', barrio: 'balvanera' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.isCaba).toBe(true);
  });

  test('barrio "otro" retorna isCaba: true (confianza en el usuario)', async ({ request }) => {
    const res = await request.post('/api/validate-address', {
      headers: headers('10.1.0.2'),
      data: { address: 'Calle Falsa 123', barrio: 'otro' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.isCaba).toBe(true);
  });

  test('sin barrio retorna isCaba: false', async ({ request }) => {
    const res = await request.post('/api/validate-address', {
      headers: headers('10.1.0.3'),
      data: { address: 'Av. Corrientes 1234', barrio: '' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.isCaba).toBe(false);
  });

  test('dirección vacía retorna isCaba: false', async ({ request }) => {
    const res = await request.post('/api/validate-address', {
      headers: headers('10.1.0.4'),
      data: { address: '', barrio: 'palermo' },
    });
    expect(res.status()).toBe(400);
  });

  test('body inválido retorna 400', async ({ request }) => {
    const res = await request.post('/api/validate-address', {
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:4321', 'X-Forwarded-For': '10.1.0.5' },
      data: 'esto no es json valido',
    });
    expect(res.status()).toBe(400);
  });

});

test.describe('API /create-preference — validaciones server-side', () => {

  test('rechaza producto inexistente', async ({ request }) => {
    const res = await request.post('/api/create-preference', {
      headers: headers('10.2.0.1'),
      data: {
        items: [{ productId: 'producto-inventado', quantity: 1 }],
        customer: { name: 'Test', phone: '1112345678', address: 'Corrientes 1234', barrio: 'balvanera' },
        deliveryDate: '2099-01-15',
        deliveryTime: '14:00-16:00',
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/producto no válido/i);
  });

  test('rechaza payload sin items', async ({ request }) => {
    const res = await request.post('/api/create-preference', {
      headers: headers('10.2.0.2'),
      data: {
        items: [],
        customer: { name: 'Test', phone: '1112345678', address: 'Corrientes 1234', barrio: 'balvanera' },
      },
    });
    expect(res.status()).toBe(400);
  });

  test('rechaza dirección fuera de CABA', async ({ request }) => {
    const res = await request.post('/api/create-preference', {
      headers: headers('10.2.0.3'),
      data: {
        items: [{ productId: 'empanaditas', quantity: 10 }],
        customer: { name: 'Test', phone: '1112345678', address: 'Rivadavia 8775', barrio: 'la matanza' },
        deliveryDate: '2099-01-15',
        deliveryTime: '14:00-16:00',
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/CABA|Capital Federal/i);
  });

  test('rechaza fecha de entrega pasada', async ({ request }) => {
    const res = await request.post('/api/create-preference', {
      headers: headers('10.2.0.4'),
      data: {
        items: [{ productId: 'combo-a', quantity: 1 }],
        customer: { name: 'Test', phone: '1112345678', address: 'Corrientes 1234', barrio: 'balvanera' },
        deliveryDate: '2000-01-01',
        deliveryTime: '14:00-16:00',
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/fecha|anticipación/i);
  });

  test('rechaza horario de entrega inválido', async ({ request }) => {
    const res = await request.post('/api/create-preference', {
      headers: headers('10.2.0.5'),
      data: {
        items: [{ productId: 'combo-a', quantity: 1 }],
        customer: { name: 'Test', phone: '1112345678', address: 'Corrientes 1234', barrio: 'balvanera' },
        deliveryDate: '2099-01-15',
        deliveryTime: '03:00-05:00',
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/horario/i);
  });

});
