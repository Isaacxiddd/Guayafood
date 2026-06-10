import { s as saveOrder } from './google-sheets_fqIzo0_Q.mjs';

const prerender = false;
const POST = async ({ request }) => {
  try {
    const body = await request.json();
    if (!body.preferenceId || !body.name || !body.address) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }
    await saveOrder({
      preferenceId: body.preferenceId,
      status: body.status || "pendiente",
      name: body.name,
      phone: body.phone || "",
      address: body.address,
      items: body.items || [],
      total: body.total || 0,
      notes: body.notes || ""
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request" }), { status: 400 });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST,
  prerender
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
