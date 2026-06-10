# Plan del Sistema de Pagos — Guayafood 🥟

> **Framework:** Astro v6 (static) + Vercel Serverless Functions  
> **Stack:** Tailwind CSS v4 · Mercado Pago SDK · Google Sheets API · Playwright  
> **Estado actual:** Proyecto funcional con landing page, MP básico y Google Sheets

---

## 📦 Fase 0 — Arquitectura actual (lo que ya funciona)

```
Usuario → PaymentButton → OrderModal → /api/create-preference → MP Checkout Pro
                                                                        ↓
                                                              Usuario paga/cancela
                                                                        ↓
                                                              Redirect a /?status=
                                                                        ↓
                                                              Banner éxito/error (solo UI)
```

**Ya existe:**
- ✅ Landing page con productos, combos, galería, historia
- ✅ Modal de pedido con cantidad, nombre, teléfono, dirección (valida CABA)
- ✅ API `/api/create-preference.ts` (crea preferencia en MP con SDK oficial)
- ✅ API `/api/save-order.ts` (guarda en Google Sheets — **no se llama desde frontend**)
- ✅ 10 tests Playwright cubriendo landing page
- ✅ CI/CD con GitHub Actions
- ✅ Variables de entorno (`MERCADOPAGO_ACCESS_TOKEN`, `GOOGLE_CREDENTIALS_BASE64`, etc.)
- ✅ Link directo MP hardcodeado: `https://link.mercadopago.com.ar/guayafood`

---

## 🚀 Fase 1 — Pedidos programados (fecha y hora)

### 1.1 Agregar campos de programación al modal

**Archivo:** `src/components/OrderModal.astro`

Agregar debajo del campo "Dirección":

```html
<div>
  <label class="block text-sm font-semibold text-texto mb-1">
    Fecha de entrega <span class="text-xs text-vinotinto">(pedido con anticipación)</span>
  </label>
  <input id="field-date" type="date" class="..." min="{fechaMinima}" />
</div>
<div>
  <label class="block text-sm font-semibold text-texto mb-1">Horario de entrega</label>
  <select id="field-time" class="...">
    <option value="">Seleccioná un horario</option>
    <option value="10:00-12:00">10:00 - 12:00 hs</option>
    <option value="14:00-16:00">14:00 - 16:00 hs</option>
    <option value="17:00-19:00">17:00 - 19:00 hs</option>
    <option value="19:00-21:00">19:00 - 21:00 hs</option>
  </select>
</div>
```

**Validaciones:**
- `fechaMinima`: día siguiente al actual (pedido con 24 hs de anticipación)
- No permitir domingos
- No permitir fechas pasadas

### 1.2 Enviar fecha/hora a la API

Modificar el `fetch` a `MP_API_URL` para incluir:

```typescript
body: JSON.stringify({
  items: [...],
  customer: { name, phone, address },
  notes,
  deliveryDate: fieldDate.value,
  deliveryTime: fieldTime.value,
})
```

### 1.3 Actualizar `create-preference.ts`

- Recibir `deliveryDate` y `deliveryTime` en el body
- Incluir `external_reference` con la fecha programada (ej: `order_1718000000_2025-06-15_14-16`)
- Opcional: agregar metadatos al `preference.create` si MP lo permite (no es crítico)

### 1.4 Aviso visual al usuario

Agregar un banner info dentro del modal:

> 📅 Pedí con anticipación. Elegí el día y horario que prefieras.  
> 📍 Solo entregamos en **Capital Federal**.

---

## 💾 Fase 2 — Guardado automático en Google Sheets

### 2.1 Llamar a `/api/save-order` después del pago exitoso

**Archivo:** `src/pages/index.astro` (script inline)

Cuando `status === 'approved'`, hacer un `fetch` a `/api/save-order` con los datos completos:

```typescript
if (status === 'approved') {
  // Recuperar datos del pago desde sessionStorage
  const orderData = sessionStorage.getItem('guayafood_order');
  if (orderData) {
    const data = JSON.parse(orderData);
    await fetch('/api/save-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preferenceId,
        status: 'approved',
        name: data.name,
        phone: data.phone,
        address: data.address,
        items: data.items,
        total: data.total,
        notes: data.notes,
        deliveryDate: data.deliveryDate,
        deliveryTime: data.deliveryTime,
      }),
    });
    sessionStorage.removeItem('guayafood_order');
  }
  // mostrar banner de éxito...
}
```

### 2.2 Guardar datos del pedido en `sessionStorage` antes de redirigir a MP

**Archivo:** `src/components/OrderModal.astro`

Justo antes de `window.location.href = data.init_point`:

```typescript
sessionStorage.setItem('guayafood_order', JSON.stringify({
  name, phone, address, notes,
  deliveryDate: fieldDate.value,
  deliveryTime: fieldTime.value,
  items: [{ title: currentData.name, quantity, unitPrice: currentData.unitPrice }],
  total: currentData.unitPrice * quantity,
}));
```

### 2.3 Actualizar `save-order.ts`

Agregar nuevas columnas a la planilla:

| Columna actual | Columna nueva |
|---|---|
| — | **Fecha de entrega** |
| — | **Horario** |
| — | **Referencia del lugar** |

Campos a recibir en el body:
```typescript
deliveryDate?: string;
deliveryTime?: string;
reference?: string;
```

---

## 🧩 Fase 3 — Combos personalizados

### 3.1 Crear componente `CustomCombo.astro`

```
src/components/
├── CustomCombo.astro       # 🆕 Componente principal del builder
├── CustomComboModal.astro  # 🆕 Modal del builder (o integrado)
```

**Flujo del usuario:**

```
Botón "Armá tu combo" (en sección Combos)
  → Se abre CustomComboModal
  → Paso 1: Elegir base (Combo A/B/C o armado libre)
  → Paso 2: Elegir categorías y cantidad de piezas
     - Empanaditas: ___ (cantidad, máx 10)
     - Tequeños: ___ (cantidad, máx 10)
     - Pastelitos: ___ (cantidad, máx 5)
  → Paso 3: Elegir salsas (1 o 2 según combo)
  → Paso 4: Resumen + datos de entrega (reutilizar lógica de OrderModal)
  → Paso 5: Pagar con MP o pedir por WhatsApp
```

### 3.2 Lógica de precios

| Combo | Piezas | Salsas | Precio |
|-------|--------|--------|--------|
| Combo A | 10 | 1 salsa | $10.000 |
| Combo B | 15 | 1 salsa | $14.500 |
| Combo C | 20 | 2 salsas | $18.000 |
| **Personalizado** | a elección | a elección | según piezas |

Para el custom:
- Empanadita: $1.500 c/u
- Tequeño: $1.000 c/u
- Pastelito: $1.800 c/u
- Salsa extra: $500

### 3.3 Agregar a `config.ts`

```typescript
export const CUSTOM_COMBO = {
  title: 'Armá tu combo',
  description: 'Elegí las piezas que quieras y armalo a tu gusto',
  maxItems: 20,
  categories: [
    { name: 'Empanaditas', unitPrice: 1500, emoji: '🥟', max: 10 },
    { name: 'Tequeños', unitPrice: 1000, emoji: '🧀', max: 10 },
    { name: 'Pastelitos', unitPrice: 1800, emoji: '🥟', max: 5 },
  ],
  sauces: [
    { name: 'Salsa de ajo', price: 500 },
    { name: 'Salsa guasacaca', price: 500 },
  ],
  freeSauces: 1, // salsas incluidas
  extraSaucePrice: 500,
};
```

### 3.4 UI del CustomComboModal

Diseño tipo "McDonald's":

```
┌─────────────────────────────────┐
│  🧩 Armá tu combo               │
│                                 │
│  ┌─────────────────────────┐    │
│  │ ¿Cuántas empanaditas?   │    │
│  │  [−]  0  [+]  (max 10)  │    │
│  ├─────────────────────────┤    │
│  │ ¿Cuántos tequeños?      │    │
│  │  [−]  0  [+]  (max 10)  │    │
│  ├─────────────────────────┤    │
│  │ ¿Cuántos pastelitos?    │    │
│  │  [−]  0  [+]  (max 5)   │    │
│  ├─────────────────────────┤    │
│  │ Salsas                  │    │
│  │ ☐ Salsa de ajo          │    │
│  │ ☐ Salsa guasacaca       │    │
│  ├─────────────────────────┤    │
│  │ Total: $X.XXX           │    │
│  │                         │    │
│  │ [Ir a pagar con MP]     │    │
│  │ [Pedir por WhatsApp]    │    │
│  └─────────────────────────┘    │
└─────────────────────────────────┘
```

### 3.5 Navegación

El `CustomComboModal` debe enviar la orden igual que `OrderModal`:
- Si el usuario elige pagar: `POST /api/create-preference` → MP
- Si el usuario elige WhatsApp: link directo con detalle del combo

---

## 📋 Fase 4 — Referencia del lugar y condiciones

### 4.1 Agregar campo "Referencia"

En `OrderModal.astro` (y `CustomComboModal.astro`), después del campo dirección:

```html
<div>
  <label class="block text-sm font-semibold text-texto mb-1">Referencia del lugar (opcional)</label>
  <input id="field-reference" type="text" placeholder="Ej: Dpto 3B, timbre 5, edificio blanco" class="..." />
</div>
```

### 4.2 Condiciones visibles

Agregar un aviso antes del botón de pago:

```html
<div class="bg-azul/5 rounded-xl p-3 mb-4">
  <p class="text-xs text-azul/80 leading-relaxed">
    📍 Solo entregamos en <strong>Capital Federal</strong>.
    Los pedidos se preparan con <strong>anticipación</strong>.
    Elegí una fecha y horario disponibles.
  </p>
</div>
```

---

## 🧪 Fase 5 — Tests Playwright

### 5.1 Tests nuevos a agregar en `tests/lading.spec.ts`

| # | Test | Descripción |
|---|------|-------------|
| 11 | Modal se abre al hacer clic en MP | Verificar que `#order-modal-overlay` se muestra |
| 12 | Validación de dirección CABA | Ingresar dirección inválida, ver error |
| 13 | Selector de cantidad funciona | Probar botones + y - |
| 14 | Campos de fecha/hora existen | Verificar que `#field-date` y `#field-time` están en el modal |
| 15 | Fecha mínima no permite pasado | `field-date.min` debe ser >= hoy |
| 16 | Custom combo button exists | Verificar que hay un botón "Armá tu combo" |
| 17 | Custom combo modal opens | Hacer clic en "Armá tu combo" y verificar modal visible |
| 18 | WhatsApp link en éxito de pago | Simular `?status=approved` y verificar banner verde |
| 19 | Botón de WhatsApp en modal funciona | Verificar link a wa.me con número correcto |
| 20 | Referencia del lugar visible | Campo `#field-reference` debe existir |

### 5.2 Crear test de API

Crear `tests/api.spec.ts`:

| # | Test | Descripción |
|---|------|-------------|
| 1 | POST /api/create-preference rejects missing body | 400 con body vacío |
| 2 | POST /api/create-preference rejects no items | 400 sin items |
| 3 | POST /api/create-preference rejects no customer | 400 sin customer |
| 4 | POST /api/save-order rejects no preferenceId | 400 sin preferenceId |
| 5 | GET /api/create-preference returns 405 | Method not allowed |

---

## 🔐 Fase 6 — Seguridad y buenas prácticas

### 6.1 Ya implementado ✅
- ✅ Credenciales en variables de entorno (`.env`)
- ✅ Frontend nunca ve `MERCADOPAGO_ACCESS_TOKEN`
- ✅ API routes en Vercel Serverless Functions
- ✅ No hay secretos en el repositorio

### 6.2 Por agregar
- **Validación extra en backend:** Sanitizar inputs, limitar tamaños
- **Rate limiting:** Opcional, para evitar abuso de la API
- **Logging:** Mejorar logs en errores de MP (ya hay `console.error`)
- **CORS:** Las funciones serverless de Vercel no necesitan CORS explícito (mismo dominio)
- **Timeouts:** Manejar timeout en llamadas a MP SDK

---

## 🗺️ Roadmap visual

```
Fase 1 ─── Pedidos programados (fecha/hora)
  ├── Campos date + time en OrderModal
  ├── Validación: 24hs anticipación, solo CABA
  └── Envío a create-preference

Fase 2 ─── Guardado automático en Google Sheets
  ├── sessionStorage antes de redirigir a MP
  ├── Llamar a /api/save-order al volver (status=approved)
  ├── Nuevas columnas: Fecha entrega, Horario, Referencia
  └── Actualizar save-order.ts

Fase 3 ─── Combos personalizados
  ├── CustomCombo.astro + CustomComboModal.astro
  ├── Lógica de precios por pieza
  ├── PaymentButton customizado
  └── Integración con MP + WhatsApp

Fase 4 ─── Referencia del lugar + condiciones UI
  ├── Campo "referencia" en formulario
  └── Banner de condiciones

Fase 5 ─── Tests Playwright (10 nuevos + 5 de API)
  ├── Tests de modal, validaciones, combos
  └── Tests de API endpoints

Fase 6 ─── Seguridad y pulido
  ├── Rate limiting
  ├── Sanitización
  └── Logging mejorado
```

---

## 📁 Entregables por archivo

| Archivo | Acción |
|---------|--------|
| `src/lib/config.ts` | Agregar `CUSTOM_COMBO`, `DELIVERY` config |
| `src/components/OrderModal.astro` | Agregar fecha, hora, referencia, conditions, sessionStorage |
| `src/components/CustomCombo.astro` | **Nuevo** — botón "Armá tu combo" |
| `src/components/CustomComboModal.astro` | **Nuevo** — builder de combos personalizados |
| `src/components/Combos.astro` | Integrar CustomCombo (botón adicional) |
| `api/create-preference.ts` | Recibir/validar deliveryDate, deliveryTime |
| `api/save-order.ts` | Recibir fecha, hora, referencia; agregar columnas al sheet |
| `src/pages/index.astro` | Llamar a save-order tras pago exitoso |
| `tests/lading.spec.ts` | +10 tests de UI |
| `tests/api.spec.ts` | **Nuevo** — 5 tests de API |
| `.env.example` | Documentar nuevas variables si aplica |
| `PLAN.md` | Este archivo |

---

## ⚙️ Config de delivery en `config.ts` (propuesta)

```typescript
export const DELIVERY = {
  zones: ['Capital Federal', 'CABA'],
  advanceHours: 24,
  workingDays: [1, 2, 3, 4, 5, 6], // 1=lunes, 7=domingo
  timeSlots: [
    { label: '10:00 - 12:00 hs', value: '10:00-12:00' },
    { label: '14:00 - 16:00 hs', value: '14:00-16:00' },
    { label: '17:00 - 19:00 hs', value: '17:00-19:00' },
    { label: '19:00 - 21:00 hs', value: '19:00-21:00' },
  ],
  warningText: '📍 Solo entregamos en Capital Federal. Pedí con anticipación (mín 24 hs).',
};
```

---

## 🧮 Ejemplo de flujo completo

```
1. Usuario ve producto/Combo A → clic "Comprar con MP"
2. Se abre OrderModal
3. Usuario selecciona cantidad: 3
4. Ingresa:
   - Nombre: "Leidy"
   - Teléfono: "11 1234 5678"
   - Dirección: "Av. Corrientes 1234, CABA"
   - Fecha: "15/06/2025"
   - Horario: "17:00 - 19:00 hs"
   - Referencia: "Dpto 4B, timbre 5"
5. → primer fetch a /api/create-preference (MP crea preferencia)
6. → guarda en sessionStorage los datos del pedido
7. → redirige a MP Checkout Pro
8. Usuario paga con MP
9. → vuelve a /?status=approved&preference_id=123456
10. → index.astro:
    a) Lee sessionStorage → llama a /api/save-order
    b) Muestra banner verde de éxito
11. Google Sheets recibe:
    Fecha | Preference ID | Estado | Nombre | Teléfono | Dirección | Productos | Total | Notas | Fecha entrega | Horario | Referencia
```

---

## 📐 Notas técnicas

- **Astro output:** `static` — no usa SSR. Las API routes son serverless functions independientes.
- **Google Sheets:** Usa Service Account con `google-spreadsheet` v5.3.0. Las credenciales van en base64 en `GOOGLE_CREDENTIALS_BASE64`.
- **Mercado Pago SDK:** v3.1.0, usando `MercadoPagoConfig` + `Preference`.
- **sessionStorage:** Se usa para persistir datos del pedido entre la redirección a MP y el retorno. Los datos se limpian inmediatamente después de guardar.
- **Tests:** Playwright corre en Chromium (desktop) + iPhone 12 (mobile). Servidor web: build + preview.

---

## ✅ Criterios de éxito

- [ ] Pedidos con fecha/hora se envían correctamente a MP y Google Sheets
- [ ] No se pueden seleccionar fechas pasadas ni domingos
- [ ] Dirección inválida (fuera de CABA) muestra error
- [ ] Al volver de MP con pago exitoso, la orden se guarda en Google Sheets
- [ ] Combos personalizados permiten elegir piezas y calculan precio correcto
- [ ] Link directo MP (`link.mercadopago.com.ar/guayafood`) sigue funcionando
- [ ] Todos los tests existentes + nuevos pasan
- [ ] Credenciales no expuestas al frontend
- [ ] Usuario ve condiciones claras (CABA, anticipación)
