import { GoogleSpreadsheet } from 'google-spreadsheet';

function getCredentials() {
  const base64 = process.env.GOOGLE_CREDENTIALS_BASE64;
  if (!base64) return null;
  try {
    return JSON.parse(Buffer.from(base64, "base64").toString());
  } catch {
    return null;
  }
}
function getSheetId() {
  return process.env.GOOGLE_SHEET_ID || "";
}
async function saveOrder(data) {
  const creds = getCredentials();
  const sheetId = getSheetId();
  if (!creds || !sheetId) {
    console.warn("Google Sheets not configured, skipping save");
    return;
  }
  const doc = new GoogleSpreadsheet(sheetId);
  await doc.useServiceAccountAuth(creds);
  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0] || await doc.addSheet({ title: "Pedidos" });
  if (sheet.rowCount === 0) {
    await sheet.setHeaderRow([
      "Fecha",
      "Preference ID",
      "Estado",
      "Nombre",
      "Teléfono",
      "Dirección",
      "Productos",
      "Total",
      "Notas"
    ]);
  }
  await sheet.addRow({
    Fecha: (/* @__PURE__ */ new Date()).toISOString(),
    "Preference ID": data.preferenceId,
    Estado: data.status,
    Nombre: data.name,
    Teléfono: data.phone,
    Dirección: data.address,
    Productos: data.items.map((i) => `${i.title} x${i.quantity}`).join(", "),
    Total: `$${data.total.toLocaleString("es-AR")}`,
    Notas: data.notes || ""
  });
}

export { saveOrder as s };
