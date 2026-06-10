import { MercadoPagoConfig, Preference } from 'mercadopago';
import { s as saveOrder } from './google-sheets_fqIzo0_Q.mjs';

const prerender = false;
const POST = async ({ request }) => {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Missing MERCADOPAGO_ACCESS_TOKEN" }), { status: 500 });
  }
  const siteUrl = process.env.PUBLIC_SITE_URL || "https://guayafood.vercel.app";
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }
  if (!body.items?.length || !body.customer?.name || !body.customer?.address) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
  }
  const total = body.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  try {
    const client = new MercadoPagoConfig({ accessToken });
    const preference = new Preference(client);
    const result = await preference.create({
      body: {
        items: body.items.map((i) => ({
          title: i.title,
          quantity: i.quantity,
          unit_price: i.unitPrice,
          currency_id: "ARS"
        })),
        payer: {
          name: body.customer.name,
          phone: { number: body.customer.phone }
        },
        back_urls: {
          success: `${siteUrl}/?status=approved&preference_id={{preference_id}}`,
          failure: `${siteUrl}/?status=failure&preference_id={{preference_id}}`,
          pending: `${siteUrl}/?status=pending&preference_id={{preference_id}}`
        },
        auto_return: "approved",
        external_reference: `order_${Date.now()}`
      }
    });
    const preferenceId = result.id;
    const initPoint = result.init_point;
    const externalRef = result.external_reference;
    await saveOrder({
      preferenceId,
      status: "pendiente",
      name: body.customer.name,
      phone: body.customer.phone,
      address: body.customer.address,
      items: body.items,
      total,
      notes: body.notes
    });
    return new Response(
      JSON.stringify({ preference_id: preferenceId, init_point: initPoint, total }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Mercado Pago error:", error);
    return new Response(JSON.stringify({ error: "Failed to create preference" }), { status: 500 });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
