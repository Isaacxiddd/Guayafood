import { c as createComponent } from './astro-component_D94EcWni.mjs';
import { o as renderComponent, k as renderTemplate, m as maybeRenderHead } from './entrypoint_Be9IuGSX.mjs';
import { $ as $$Layout, N as NOT_FOUND } from './Layout_k97le57L.mjs';

const $$404 = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, {}, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="min-h-screen flex flex-col items-center justify-center px-4 text-center"> <span class="text-8xl mb-6">${NOT_FOUND.emoji}</span> <h1 class="font-heading text-4xl font-bold text-vinotinto mb-4">${NOT_FOUND.title}</h1> <p class="text-texto-light mb-8 text-lg">${NOT_FOUND.description}</p> <a href="/" class="inline-flex items-center gap-2 bg-vinotinto hover:bg-vinotinto-light text-white px-8 py-3 rounded-full font-semibold transition-all"> ${NOT_FOUND.cta} </a> </div> ` })}`;
}, "C:/Users/ISAAC GARCIA/Downloads/guayafood/guayafood/src/pages/404.astro", void 0);

const $$file = "C:/Users/ISAAC GARCIA/Downloads/guayafood/guayafood/src/pages/404.astro";
const $$url = "/404";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$404,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
