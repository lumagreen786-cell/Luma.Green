/** @typedef {{brand: {name: string}, common: {retry: string, error: string, close: string}, nav: {home: string}, native: Record<string, string>, notifications: Record<string, string>}} Messages */
/** @param {string} language @param {Record<string, Messages>} catalogues */
export function selectLocale(language, catalogues) {
  const short = language.toLowerCase().split("-", 1)[0];
  return short && Object.hasOwn(catalogues, short) ? short : "en";
}
/** @param {string} url @param {Record<string, Messages>} catalogues @param {string} fallback */
export function pageLocale(url, catalogues, fallback) {
  try {
    const segment = new URL(url).pathname.split("/", 2)[1];
    if (segment === "admin") return "en";
    return segment && Object.hasOwn(catalogues, segment) ? segment : "en";
  } catch {
    return fallback;
  }
}
/** @param {string} value */
export function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
/** No script, bridge or remote dependency. The trusted retry navigation is intercepted by main.
 * @param {Messages} messages @param {string} locale @param {string} home */
export function offlineHtml(messages, locale, home) {
  const e = escapeHtml;
  return `<!doctype html><html lang="${e(locale)}" dir="${["ar", "ur"].includes(locale) ? "rtl" : "ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${e(messages.native.offlineTitle)}</title><style>:root{color-scheme:light dark;--canvas:#f4f8ee;--ink:#14161c;--line:#14161c26}body{background:var(--canvas);color:var(--ink);font-family:system-ui,sans-serif;max-inline-size:36rem;margin:12vh auto;padding:2rem;line-height:1.6}main{border-top:1px solid var(--line);padding-top:2rem}a{display:inline-flex;align-items:center;min-height:44px;padding:.5rem 1.5rem;border-radius:1rem;background:#9bf80f;color:#10130a;font-weight:600;text-decoration:none;outline-offset:4px}a:focus-visible{outline:2px solid var(--ink)}h1{font-size:clamp(2rem,6vw,3.5rem);font-weight:500;letter-spacing:-.04em;line-height:1.08;overflow-wrap:anywhere}@media(prefers-color-scheme:dark){:root{--canvas:#080b14;--ink:#f5f6f8;--line:#ffffff26}}</style></head><body><main><p>${e(messages.brand.name)}</p><h1>${e(messages.native.offlineTitle)}</h1><p>${e(messages.native.offlineBody)}</p><a href="${e(home)}">${e(messages.common.retry)}</a></main></body></html>`;
}
