import { classifyNavigation } from "./navigation.ts";

export const LOCATION_TIMEOUT_MS = 30_000;

export interface LocationRequest {
  type: "luma.location.current";
  requestId: string;
  nonce: string;
  options: { enableHighAccuracy: boolean; timeout: number };
}

export interface WebPosition {
  timestamp: number;
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude: number | null;
    altitudeAccuracy: number | null;
    heading: number | null;
    speed: number | null;
  };
}

export type LocationResult = { requestId: string } & (
  { position: WebPosition } | { error: { code: 1 | 2 | 3; message: string } }
);

/** The exact current trusted top document can request one position, never supply it. */
export function parseLocationRequest(
  raw: string,
  frameUrl: string,
  topUrl: string,
  origin: string,
  nonce: string,
): LocationRequest | null {
  if (
    !nonce ||
    frameUrl !== topUrl ||
    raw.length > 512 ||
    classifyNavigation(frameUrl, origin) !== "internal"
  )
    return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      !value ||
      typeof value !== "object" ||
      Object.keys(value).length !== 4 ||
      !("nonce" in value) ||
      value.nonce !== nonce ||
      !("type" in value) ||
      value.type !== "luma.location.current" ||
      !("requestId" in value) ||
      typeof value.requestId !== "string" ||
      !/^[\w-]{1,64}$/.test(value.requestId) ||
      !("options" in value)
    )
      return null;
    const options = value.options;
    if (
      !options ||
      typeof options !== "object" ||
      Object.keys(options).length !== 2 ||
      !("enableHighAccuracy" in options) ||
      typeof options.enableHighAccuracy !== "boolean" ||
      !("timeout" in options) ||
      typeof options.timeout !== "number" ||
      !Number.isFinite(options.timeout) ||
      options.timeout < 0 ||
      options.timeout > LOCATION_TIMEOUT_MS
    )
      return null;
    return {
      type: value.type,
      requestId: value.requestId,
      nonce,
      options: {
        enableHighAccuracy: options.enableHighAccuracy,
        timeout: options.timeout,
      },
    };
  } catch {
    return null;
  }
}

export function locationResultScript(
  documentUrl: string,
  result: LocationResult,
): string {
  return `if(window.top===window&&window.location.href===${JSON.stringify(documentUrl)}){document.dispatchEvent(new CustomEvent('luma-location-result',{detail:${JSON.stringify(result)}}));}true;`;
}

/** Only getCurrentPosition is replaced; browser watchPosition stays untouched. */
export function locationBridgeScript(origin: string, nonce: string): string {
  if (!nonce) return "true;";
  return String.raw`(function(){
    if(window.top!==window||window.location.origin!==${JSON.stringify(origin)}||/^\/+admin(?:\/|$)/i.test(decodeURIComponent(window.location.pathname).replace(/\\/g,'/'))||!window.ReactNativeWebView||!navigator.geolocation)return;
    var geo=navigator.geolocation;
    if(geo.__lumaCurrentPosition)return;
    var pending=new Map(),sequence=0,nonce=${JSON.stringify(nonce)};
    function fail(callback,code){if(typeof callback==='function')callback({code:code,message:'',PERMISSION_DENIED:1,POSITION_UNAVAILABLE:2,TIMEOUT:3});}
    function current(success,error,options){
      if(typeof success!=='function')throw new TypeError('A success callback is required');
      var timeout=options&&Number(options.timeout);
      if(!Number.isFinite(timeout))timeout=${String(LOCATION_TIMEOUT_MS)};
      timeout=Math.max(0,Math.min(timeout,${String(LOCATION_TIMEOUT_MS)}));
      var id=Date.now().toString(36)+'-'+(++sequence).toString(36);
      var timer=setTimeout(function(){pending.delete(id);fail(error,3);},timeout);
      pending.set(id,{success:success,error:error,timer:timer});
      try{window.ReactNativeWebView.postMessage(JSON.stringify({type:'luma.location.current',requestId:id,nonce:nonce,options:{enableHighAccuracy:!!(options&&options.enableHighAccuracy),timeout:timeout}}));}
      catch(e){clearTimeout(timer);pending.delete(id);fail(error,2);}
    }
    document.addEventListener('luma-location-result',function(event){
      var result=event.detail,item=result&&pending.get(result.requestId);
      if(!item)return;
      pending.delete(result.requestId);clearTimeout(item.timer);
      if(result.position)item.success(result.position);else if(result.error)fail(item.error,result.error.code);
    });
    Object.defineProperty(geo,'getCurrentPosition',{configurable:true,writable:true,value:current});
    Object.defineProperty(geo,'__lumaCurrentPosition',{value:true});
  })();true;`;
}
