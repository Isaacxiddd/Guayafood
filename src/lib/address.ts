const CABA_BARRIOS = new Set([
  'capital federal', 'caba', 'ciudad autonoma de buenos aires',
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
]);

export async function validateCabaAddress(address: string, barrio?: string): Promise<{
  isCaba: boolean;
  confidence: string;
  error?: string;
}> {
  const addr = (address || '').trim();
  if (!addr) {
    return { isCaba: false, confidence: 'baja', error: 'Falta la dirección' };
  }

  const b = (barrio || '').toLowerCase().trim();
  if (!b) {
    return { isCaba: false, confidence: 'baja', error: 'Seleccioná un barrio de CABA o "Otro" si no aparece en la lista.' };
  }

  if (b === 'otro') {
    return { isCaba: true, confidence: 'media' };
  }

  if (CABA_BARRIOS.has(b) || b === 'constitucion') {
    return { isCaba: true, confidence: 'alta' };
  }

  return { isCaba: false, confidence: 'baja', error: 'El barrio seleccionado no corresponde a CABA.' };
}
