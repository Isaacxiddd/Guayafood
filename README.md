# Guayafood

**Comida venezolana casera en Buenos Aires**
*"Desde mi cocina, para tu corazón"*

[![Astro](https://img.shields.io/badge/Astro-6.x-FF5D01?style=flat-square&logo=astro&logoColor=white)](https://astro.build)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?style=flat-square&logo=vercel&logoColor=white)](https://vercel.com)
[![pnpm](https://img.shields.io/badge/pnpm-11-F69220?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io)
[![Node](https://img.shields.io/badge/Node-%E2%89%A522-5FA04E?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org)

**Demo en vivo:** [guayafood.vercel.app](https://guayafood.vercel.app)

---

## El problema que resuelve

Un emprendimiento de comida casera que toma pedidos por WhatsApp enfrenta tres fricciones concretas:

1. **Sin presencia web** — los clientes nuevos no pueden descubrir el negocio ni ver el menú actualizado.
2. **Sin checkout integrado** — cada pedido requiere negociación manual del precio y los datos de pago.
3. **Sin validación de zona** — se confirman pedidos fuera de cobertura que luego no se pueden entregar.

Este sitio elimina las tres: es la cara pública del negocio, permite pagar con Mercado Pago antes de confirmar, y valida automáticamente que la dirección esté dentro de CABA.

---

## Capturas

| Hero | Productos | Combos |
|---|---|---|
| ![Hero](docs/screenshots/screenshot-hero.png) | ![Productos](docs/screenshots/screenshot-productos.png) | ![Combos](docs/screenshots/screenshot-combos.png) |

| Galería | Cómo pedir | Footer |
|---|---|---|
| ![Galería](docs/screenshots/screenshot-galeria.png) | ![Cómo pedir](docs/screenshots/screenshot-como-pedir.png) | ![Footer](docs/screenshots/screenshot-footer.png) |

<details>
<summary>Ver página completa</summary>

![Full page](docs/screenshots/screenshot-full.png)

</details>

---

## Stack

| | Tecnología | Por qué |
|---|---|---|
| ![Astro](https://img.shields.io/badge/-Astro-FF5D01?style=flat-square&logo=astro&logoColor=white) | Astro 6 (SSR) | HTML estático donde puede, Edge Functions para la API. Mínimo JS al cliente. |
| ![Tailwind](https://img.shields.io/badge/-Tailwind-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white) | Tailwind CSS v4 | Sin CSS custom en el 95% del proyecto. |
| ![Vercel](https://img.shields.io/badge/-Vercel-000000?style=flat-square&logo=vercel&logoColor=white) | Vercel | Free tier suficiente. CI/CD automático con GitHub. |
| ![MP](https://img.shields.io/badge/-Mercado%20Pago-009EE3?style=flat-square&logo=mercadopago&logoColor=white) | Mercado Pago Checkout Pro | Dominante en Argentina. Sin PCI compliance propio. |
| ![Sheets](https://img.shields.io/badge/-Google%20Sheets-34A853?style=flat-square&logo=googlesheets&logoColor=white) | Google Sheets | Cero infraestructura. El operador ya sabe usarlo. |
| ![Playwright](https://img.shields.io/badge/-Playwright-2EAD33?style=flat-square&logo=playwright&logoColor=white) | Playwright | Tests e2e del flujo de pedido. |

---

## Arquitectura

```
Browser
  │
  ├── GET /          → Astro SSG: Hero, Productos, Combos, Galería, Cómo pedir
  │
  ├── POST /api/validate-address    → Valida que la dirección sea de CABA
  ├── POST /api/create-preference   → Crea preferencia en Mercado Pago → devuelve init_point
  ├── GET  /api/verify-payment      → Post-pago: consulta metadata del pago en MP
  └── POST /api/mercadopago-webhook → MP notifica aprobación → guarda pedido en Sheets
```

El frontend nunca toca precios ni lógica de negocio: solo envía `productId` + `quantity`. El servidor resuelve el precio contra `PRODUCT_CATALOG` (la fuente de verdad) y arma la preferencia de pago.

---

## Decisiones de diseño y sus trade-offs

### Astro en vez de Next.js

La landing es contenido estático con un formulario de pedido. Cargar un runtime React completo para eso es overhead puro. Astro genera HTML nativo y solo hidrata lo que necesita JavaScript.

**Trade-off:** Si el proyecto escala a una tienda con catálogo dinámico, carrito persistente o autenticación, Astro se vuelve incómodo. Para una landing + checkout puntual, gana por goleada.

---

### Precios resueltos en el servidor

El cliente envía `{ productId, quantity }`. El servidor hace el lookup en `PRODUCT_CATALOG`.

Si el cliente enviara el precio, cualquier persona con DevTools podría pagar $1 por un combo de $18.000.

**Trade-off:** Agregar un producto nuevo requiere redeploy. Ese también es el momento en que se define el precio, así que no hay desventaja práctica.

---

### Validación de zona por barrio (no por geolocalización)

El formulario tiene un selector obligatorio de barrio porteño. El backend confía en la selección del usuario.

Las APIs de georreferenciación (Georef, Nominatim) tenían falsos negativos con direcciones reales de CABA. "Saraza 400" era rechazada. El usuario sabe en qué barrio vive mejor que cualquier API.

**Trade-off:** Alguien de provincia podría seleccionar "Palermo" igualmente. El riesgo es aceptable: el delivery se coordina por WhatsApp antes de salir, y el repartidor verifica la dirección antes de moverse. El costo de un falso positivo es menor que el de bloquear clientes válidos.

---

### PII en metadata de MP, no en la URL de retorno

Los datos del cliente (nombre, teléfono, dirección, fecha de entrega) se guardan en el campo `metadata` de la preferencia de Mercado Pago. La `back_url` de éxito es limpia: `/?status=approved`.

Base64 no es cifrado. Una URL con datos del cliente codificados en base64 queda expuesta en los logs de Vercel, los logs de MP y el header `Referer` de cualquier recurso de terceros. El `metadata` de MP vive server-side.

**Trade-off:** La página de éxito necesita hacer una llamada extra a `/api/verify-payment` para recuperar los datos del pedido. Un round-trip más a cambio de no exponer PII en URLs que pasan por múltiples sistemas de logging.

---

### Google Sheets como base de datos de pedidos

El webhook de Mercado Pago escribe cada pedido aprobado en una Google Sheet.

El operador del negocio ya sabe usar Excel/Sheets. Una base de datos real requeriría enseñarle una interfaz nueva y sumaría infra a mantener.

**Trade-off:** Google Sheets no escala bien más allá de unos miles de filas. Si el negocio procesa cientos de pedidos por semana de forma sostenida, migrar a Supabase es la decisión correcta. Para el volumen de lanzamiento, Sheets reduce la carga operativa a cero.

---

### Rate limiting en memoria

El rate limiting usa un `Map` en memoria del proceso, no Redis.

Redis suma latencia de red y costo mensual fijo para un problema que a esta escala no existe todavía.

**Trade-off:** En Vercel, cada Edge Function puede correr en una instancia diferente — el límite real es por instancia, no por IP global. Si se convierte en vector de abuso, reemplazar por Upstash Redis es el cambio correcto.

---

## Setup local

**Requisitos:** Node ≥ 22, pnpm

```bash
pnpm install
cp .env.example .env   # completar variables
pnpm dev               # http://localhost:4321
```

### Variables de entorno

| Variable | Descripción |
|---|---|
| `MERCADOPAGO_ACCESS_TOKEN` | Token de acceso de MP (producción o sandbox) |
| `PUBLIC_SITE_URL` | URL pública del sitio |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service account para escribir en Sheets |
| `GOOGLE_PRIVATE_KEY` | Clave privada del service account |
| `GOOGLE_SHEET_ID` | ID de la Google Sheet de pedidos |
| `PUBLIC_ADVANCE_HOURS` | Anticipación mínima en horas (default: `24`) |

---

## Comandos

```bash
pnpm dev        # Servidor de desarrollo en localhost:4321
pnpm build      # Build de producción
pnpm preview    # Preview del build
pnpm test       # Tests e2e con Playwright
pnpm test:ui    # UI interactiva de Playwright
pnpm lint       # Type-check con astro check
```

---

## Deploy

Push a `main` dispara deploy automático en Vercel. El adaptador `@astrojs/vercel` convierte los endpoints en Edge Functions.

El webhook de Mercado Pago debe apuntar a `https://<dominio>/api/mercadopago-webhook` desde el panel de la aplicación de MP.

---

## Seguridad

- Precios resueltos 100% en el servidor — el cliente nunca toca valores económicos
- Datos del cliente en `metadata` de MP, nunca en URLs expuestas en logs
- Pagos verificados server-side vía webhook — no se confía en el `status` de la URL de retorno
- Rate limiting por IP (20 req/min) en todos los endpoints
- Validación de header `Origin` contra whitelist de dominios
- Secretos exclusivamente en variables de entorno

Ver [`docs/lessonslearned.md`](docs/lessonslearned.md) para el detalle de cada vulnerabilidad detectada y corregida durante el desarrollo.

---

## Estructura del proyecto

```
src/
├── components/       # Hero, Productos, Combos, OrderModal, Nav, Footer, etc.
├── layouts/          # Layout base con meta tags y OG
├── lib/
│   ├── config.ts     # Catálogo de productos, precios y textos (fuente de verdad)
│   ├── rate-limit.ts # Rate limiting en memoria + validación de Origin
│   └── address.ts    # Validación de direcciones CABA por barrio
└── pages/
    ├── index.astro
    ├── 404.astro
    └── api/
        ├── create-preference.ts    # Crea preferencia de pago en MP
        ├── verify-payment.ts       # Recupera metadata post-pago
        ├── validate-address.ts     # Valida dirección CABA
        ├── mercadopago-webhook.ts  # Webhook de confirmación de pago
        └── save-order.ts           # Persiste pedido en Google Sheets
```

---

*Construido por Isaac García Márquez · Buenos Aires, 2025*
