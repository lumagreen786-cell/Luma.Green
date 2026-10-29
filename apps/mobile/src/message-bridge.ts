import { classifyNavigation } from "./navigation.ts";

/** Android may report source origin, or top URL for its legacy Java interface.
 * Neither metadata shape alone proves that a feature request came from the page. */
export function parseNativeMessage(
  raw: string,
  sourceUrl: string,
  documentUrl: string,
  origin: string,
  nonce: string,
  isAndroid: boolean,
): string | null {
  if (
    !nonce ||
    raw.length > 2048 ||
    classifyNavigation(documentUrl, origin) !== "internal"
  )
    return null;
  if (
    sourceUrl !== documentUrl &&
    !(isAndroid && (sourceUrl === origin || sourceUrl === origin + "/"))
  )
    return null;
  try {
    const value: unknown = JSON.parse(raw);
    return !value ||
      typeof value !== "object" ||
      Object.keys(value).length !== 4 ||
      !("type" in value) ||
      value.type !== "luma.native.message" ||
      !("nonce" in value) ||
      value.nonce !== nonce ||
      !("url" in value) ||
      value.url !== documentUrl ||
      !("data" in value) ||
      typeof value.data !== "string" ||
      value.data.length > 512
      ? null
      : value.data;
  } catch {
    return null;
  }
}

/** Only the trusted top document receives the native nonce. Nested frames retain
 * the library's bare transport, which the shell rejects, including on Android. */
export function messageBridgeScript(origin: string, nonce: string): string {
  if (!nonce) return "true;";
  return `(function(){
    if(window.top!==window||window.location.origin!==${JSON.stringify(origin)})return;
    var bridge=window.ReactNativeWebView;
    if(!bridge||typeof bridge.postMessage!=='function'||bridge.postMessage.__lumaEnvelope)return;
    var send=bridge.postMessage.bind(bridge);
    var wrapped=function(data){
      if(window.top!==window||window.location.origin!==${JSON.stringify(origin)}||typeof data!=='string'||data.length>512)return;
      send(JSON.stringify({type:'luma.native.message',nonce:${JSON.stringify(nonce)},url:window.location.href,data:data}));
    };
    Object.defineProperty(wrapped,'__lumaEnvelope',{value:true});
    bridge.postMessage=wrapped;
  })();true;`;
}
