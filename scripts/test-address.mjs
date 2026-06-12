import { validateCabaAddress } from '../src/lib/address.ts';

const tests = [
  { address: 'Saraza 400', barrio: '', desc: 'Saraza 400 sin barrio' },
  { address: 'Saraza 400', barrio: 'otro', desc: 'Saraza 400 + otro' },
  { address: 'Saraza 400', barrio: 'villa devoto', desc: 'Saraza 400 + Villa Devoto' },
  { address: 'Av. 7 N° 932', barrio: 'otro', desc: 'Av. 7 + otro' },
  { address: 'Av. 7 N° 932', barrio: '', desc: 'Av. 7 sin barrio' },
  { address: 'Av. Hipólito Yrigoyen 8775', barrio: 'otro', desc: 'Hipólito Yrigoyen + otro' },
  { address: 'Av. Hipólito Yrigoyen 8775', barrio: 'la matanza', desc: 'Hipólito Yrigoyen + La Matanza (barrio)' },
  { address: 'Calle falsa 123', barrio: 'belgrano', desc: 'Belgrano seleccionado' },
  { address: '', barrio: 'belgrano', desc: 'Direccion vacia' },
];

for (const t of tests) {
  const result = await validateCabaAddress(t.address, t.barrio);
  const icon = result.isCaba ? '✅' : '❌';
  console.log(`${icon} ${t.desc}`);
  console.log(`   "${t.address}" | barrio: "${t.barrio}" → ${result.isCaba ? 'CABA' : 'NO CABA'}`);
  if (result.error) console.log(`   ${result.error}`);
  console.log('');
}
