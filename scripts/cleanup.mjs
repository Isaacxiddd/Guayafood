/**
 * Limpia filas de prueba del Google Sheet.
 *
 * Uso:
 *   Listar tests:    node --env-file ../.env scripts/cleanup.mjs --list
 *   Borrar por ID:   node --env-file ../.env scripts/cleanup.mjs --delete test_1234567890
 *   Borrar todos:    node --env-file ../.env scripts/cleanup.mjs --purge
 *   Borrar último:   node --env-file ../.env scripts/cleanup.mjs --undo
 */

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

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
const sheet = doc.sheetsByTitle['Pedidos'];
if (!sheet) {
  console.log('❌ No se encontró la hoja "Pedidos"');
  process.exit(0);
}

await sheet.loadHeaderRow();
const rows = await sheet.getRows();
const idCol = 'ID';

if (!sheet.headerValues.includes(idCol)) {
  console.log('❌ No hay columna ID en el sheet');
  process.exit(0);
}

const args = process.argv.slice(2);
const mode = args[0];
const target = args[1];

// ---- LIST ----
if (mode === '--list') {
  const tests = rows.filter((r) => String(r.get(idCol) || '').startsWith('test_'));
  console.log(`\n📋 Filas de prueba encontradas: ${tests.length}\n`);
  if (tests.length === 0) {
    console.log('  (ninguna)');
    process.exit(0);
  }
  for (const r of tests) {
    const id = r.get(idCol);
    const name = r.get('Nombre cliente');
    const date = r.get('Fecha pedido');
    const total = r.get('Total ($)');
    console.log(`  ${id.padEnd(30)} ${(name || '').padEnd(20)} ${(total || '').padEnd(10)} ${(date || '').slice(0, 10)}`);
  }
  console.log('');
  process.exit(0);
}

// ---- DELETE by ID ----
if (mode === '--delete' && target) {
  const idx = rows.findIndex((r) => r.get(idCol) === target);
  if (idx === -1) {
    console.log(`❌ No se encontró fila con ID: ${target}`);
    process.exit(0);
  }
  await rows[idx].delete();
  console.log(`✅ Fila con ID "${target}" eliminada.`);
  process.exit(0);
}

// ---- PURGE all test_ ----
if (mode === '--purge') {
  const tests = rows.filter((r) => String(r.get(idCol) || '').startsWith('test_'));
  if (tests.length === 0) {
    console.log('✅ No hay filas de prueba para borrar.');
    process.exit(0);
  }
  for (const r of tests) {
    await r.delete();
  }
  console.log(`✅ ${tests.length} filas de prueba eliminadas.`);
  process.exit(0);
}

// ---- UNDO (delete last row) ----
if (mode === '--undo') {
  if (rows.length === 0) {
    console.log('❌ No hay filas para borrar.');
    process.exit(0);
  }
  const last = rows[rows.length - 1];
  const id = last.get(idCol);
  await last.delete();
  console.log(`✅ Última fila eliminada (ID: ${id}).`);
  process.exit(0);
}

// ---- HELP ----
console.log(`
Uso:
  --list              Listar filas de prueba (prefijo test_)
  --delete <id>       Borrar una fila por ID
  --purge             Borrar TODAS las filas test_
  --undo              Borrar la última fila
`);
