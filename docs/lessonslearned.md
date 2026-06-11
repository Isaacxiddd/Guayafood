# Security & Architecture Lessons Learned

## 1. Client-side Price Manipulation

### Problema
El precio era enviado desde el frontend a la API de Mercado Pago.

### Riesgo
Un usuario podía modificar `unitPrice` desde DevTools y pagar menos.

### Cómo se detectó
Auditoría manual intentando manipular el flujo de compra desde el navegador.

### Solución
Validación server-side de todos los productos contra una lista de precios autorizada.

### Aprendizaje
Nunca confiar en valores económicos enviados por el cliente.

## 2. Payment Status Forgery

### Problema
La URL de retorno incluía `status=approved`.

### Riesgo
Un usuario podía acceder manualmente a la página de éxito.

### Cómo se detectó
Análisis del flujo post-pago.

### Solución
Validar pagos contra Mercado Pago mediante webhook y verificación server-side.

### Aprendizaje
Los parámetros de URL no constituyen evidencia de pago.

## 3. Secret Exposure

### Problema
Un token de Mercado Pago fue incluido accidentalmente en PLAN.md.

### Riesgo
Compromiso de credenciales.

### Cómo se detectó
Revisión del repositorio.

### Solución
Revocación inmediata del token, generación de nuevas credenciales y limpieza del historial.

### Aprendizaje
Los secretos deben vivir exclusivamente en variables de entorno y deben auditarse antes de cada push.

## 4. Origin Validation

### Problema
Los endpoints aceptaban requests de cualquier origen.

### Riesgo
Spam de pedidos o abuso de APIs.

### Solución
Validación explícita del header Origin.

### Aprendizaje
No asumir que una API solo será consumida por el frontend oficial.

## 5. PII en parámetros de URL (back_url de Mercado Pago)

### Problema
Al crear la preferencia de pago, los datos del cliente (nombre, teléfono, dirección, fecha y horario de entrega, productos) se serializaban como JSON, se codificaban en base64 y se incluían como parámetro `d` en la `back_url` de éxito:

```
https://guayafood.vercel.app/?status=approved&d=eyJuIjoiSnVhbi4uLiJ9...
```

### Riesgo
Base64 no es cifrado: cualquiera con acceso a los logs puede decodificarlo con `atob()`. La URL completa queda expuesta en:
- Logs de acceso del servidor y del CDN (Vercel)
- Logs de Mercado Pago (la URL es enviada a su API al crear la preferencia)
- El header `Referer` enviado a cualquier recurso de terceros cargado en la página de éxito (analytics, fuentes, CDN de imágenes)

### Cómo se detectó
Auditoría de seguridad del código fuente: se identificó que la `back_url` contenía un parámetro con datos PII codificados en base64 en lugar de cifrados.

### Solución
Los datos del pedido se mueven al campo `metadata` de la preferencia de Mercado Pago (almacenado server-side en MP). La `back_url` de éxito queda limpia:

```
https://guayafood.vercel.app/?status=approved
```

En la página de éxito, el frontend llama a `/api/verify-payment` pasando el `payment_id` y el `preference_id` que MP incluye en la redirección. El endpoint consulta `GET /checkout/preferences/{id}` en la API de MP y devuelve el `metadata` con los datos del pedido. El PII nunca aparece en ninguna URL.

### Archivos modificados
- `src/pages/api/create-preference.ts` — datos movidos a `metadata`, removido `encodedData` y param `d`
- `src/pages/api/verify-payment.ts` — acepta `preference_id`, consulta preferencia y devuelve `orderData`
- `src/pages/index.astro` — usa `orderData` del API response, eliminada función `getDataFromUrl()`

### Aprendizaje
Un parámetro URL con base64 parece "seguro" visualmente pero es texto plano. Cualquier dato sensible del usuario que deba sobrevivir un redirect debe vivir en el servidor, no en la URL.
