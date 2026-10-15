import { clientEnv } from "./env";

interface WidgetOptions {
  sitekey: string;
  action: string;
  callback: (token: string) => void;
  "error-callback": () => void;
  "expired-callback": () => void;
  "timeout-callback": () => void;
  retry: "never";
  "response-field": false;
}
interface Turnstile {
  render: (container: HTMLElement, options: WidgetOptions) => string;
  remove: (widget: string) => void;
}
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const loader: { pending?: Promise<Turnstile> } = {};
const scriptUrl =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loader.pending) return loader.pending;
  const script = document.createElement("script");
  script.src = scriptUrl;
  script.async = true;
  loader.pending = new Promise<Turnstile>((resolve, reject) => {
    let isSettled = false;
    const fail = () => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timer);
      script.remove();
      loader.pending = undefined;
      reject(new Error("Bot check unavailable"));
    };
    const timer = setTimeout(fail, 15_000);
    script.addEventListener("error", fail, { once: true });
    script.addEventListener("load", () => {
      if (isSettled) return;
      if (!window.turnstile) {
        fail();
        return;
      }
      clearTimeout(timer);
      isSettled = true;
      resolve(window.turnstile);
    });
    document.head.append(script);
  });
  return loader.pending;
}

/** One new token per send/resend; never store or share tokens between requests. */
export async function requestBotToken(): Promise<string | null> {
  const sitekey = clientEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!sitekey) return null;
  const turnstile = await loadTurnstile();
  const container = document.createElement("div");
  container.dataset.turnstileContainer = "";
  document.body.append(container);
  let widget: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await new Promise<string>((resolve, reject) => {
      const fail = () => {
        reject(new Error("Bot check failed"));
      };
      timer = setTimeout(fail, 20_000);
      widget = turnstile.render(container, {
        sitekey,
        action: "otp_send",
        retry: "never",
        "response-field": false,
        callback: (token) => {
          if (token && token.length <= 2048) resolve(token);
          else fail();
        },
        "error-callback": fail,
        "expired-callback": fail,
        "timeout-callback": fail,
      });
    });
  } finally {
    clearTimeout(timer);
    try {
      if (widget !== undefined) turnstile.remove(widget);
    } finally {
      container.remove();
    }
  }
}
