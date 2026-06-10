/**
 * Test: simula un pago exitoso y verifica que se guarde en Google Sheets.
 *
 * Uso:
 *   Modo directo (sin servidor): node --env-file ../.env scripts/run-test.mjs
 *   Modo API (con servidor):     node scripts/run-test.mjs --api http://localhost:4321
 */

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const USE_API = process.argv.includes('--api');
const API_URL = process.argv[process.argv.indexOf('--api') + 1] || 'http://localhost:4321';

const testId = 'test_' + Date.now();

const testOrder = {
  preferenceId: testId,
  status: 'approved',
  name: 'Test Automático',
  phone: '1123456789',
  address: 'Av. Siempre Viva 123',
  barrio: 'Palermo',
  reference: 'Casa test',
  items: [
    { title: 'Empanadita carne', quantity: 2 },
    { title: 'Tequeño', quantity: 1 },
  ],
  total: 1300,
  notes: 'Pedido de prueba automática',
  deliveryDate: new Date().toISOString().split('T')[0],
  deliveryTime: '14:00-16:00',
};

async function testViaApi() {
  console.log(`🧪 Testeando vía API: ${API_URL}/api/save-order`);
  const res = await fetch(`${API_URL}/api/save-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testOrder),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`API error: ${res.status} ${body.error}`);
  console.log(`✅ API respondió:`, body);
  return testId;
}

async function testDirect() {
  console.log('🧪 Testeando escritura directa a Google Sheets...');

  const base64 = process.env.GOOGLE_CREDENTIALS_BASE64;
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!base64 || !sheetId) {
    console.error('❌ Faltan GOOGLE_CREDENTIALS_BASE64 o GOOGLE_SHEET_ID en .env');
    process.exit(1);
  }

  const creds = JSON.parse(Buffer.from(base64, 'base64').toString());
  const auth = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(sheetId, auth);
  await doc.loadInfo();
  console.log(`📄 Conectado a: ${doc.title}`);

  let sheet = doc.sheetsByTitle['Pedidos'];
  if (!sheet) {
    sheet = await doc.addSheet({ title: 'Pedidos' });
    await sheet.setHeaderRow([
      'ID', 'Fecha pedido', 'Nombre cliente', 'WhatsApp', 'Producto',
      'Combo', 'Cantidad', 'Precio unit. ($)', 'Total ($)', 'Delivery ($)',
      'Seña ($)', 'Saldo ($)', 'Origen', 'Método pago', 'Fecha entrega',
      'Dirección', 'Zona/Barrio', 'Estado', 'Notas',
    ]);
    console.log('📄 Hoja "Pedidos" creada');
  }

  const totalQty = testOrder.items.reduce((s, i) => s + i.quantity, 0);
  const itemsStr = testOrder.items.map((i) => `${i.title} x${i.quantity}`).join(', ');

  await sheet.addRow({
    ID: testId,
    'Fecha pedido': new Date().toISOString(),
    'Nombre cliente': testOrder.name,
    WhatsApp: testOrder.phone,
    Producto: itemsStr,
    Combo: '',
    Cantidad: totalQty,
    'Precio unit. ($)': '',
    'Total ($)': `$${testOrder.total.toLocaleString('es-AR')}`,
    'Delivery ($)': '',
    'Seña ($)': `$${testOrder.total.toLocaleString('es-AR')}`,
    'Saldo ($)': '$0',
    Origen: 'Web',
    'Método pago': 'Mercado Pago',
    'Fecha entrega': testOrder.deliveryDate,
    Dirección: testOrder.address,
    'Zona/Barrio': testOrder.barrio,
    Estado: testOrder.status,
    Notas: testOrder.notes,
  });

  console.log(`✅ Pedido de prueba guardado con ID: ${testId}`);
  return testId;
}

// --- main ---
const id = USE_API ? await testViaApi() : await testDirect();

console.log(`\n🔍 Para verificar: node --env-file ../.env scripts/cleanup.mjs --list`);
console.log(`🗑️  Para borrarlo:   node --env-file ../.env scripts/cleanup.mjs --delete ${id}`);
console.log(`\n✅ Test completado!`);
