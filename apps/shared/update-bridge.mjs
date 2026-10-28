/** @param {string} url @param {string} token */
export function parseUpdateNavigation(url, token) {
  if (!token) return null;
  for (const action of /** @type {const} */ (["status", "check", "restart"])) {
    if (url === "lumagreen-update://" + action + "?token=" + token)
      return action;
  }
  return null;
}

/** Restart is limited to a fresh public home document.
 * @param {string} url @param {string} origin */
export function isUpdateHome(url, origin) {
  try {
    const target = new URL(url);
    return (
      target.origin === origin &&
      !target.search &&
      !target.hash &&
      /^\/(?:[a-z]{2}\/?)?$/.test(target.pathname)
    );
  } catch {
    return false;
  }
}

/** Bounded update commands; no preload, Node or general native IPC.
 * Edits latch the current document unsafe, including across SPA navigation.
 * @param {string} origin @param {string} token @param {string} nextState
 * @param {'mobile' | 'desktop'} transport */
export function updateBridgeScript(origin, token, nextState, transport) {
  const send =
    transport === "mobile"
      ? "window.ReactNativeWebView.postMessage(JSON.stringify({type:'luma.update',nonce:token,action:action}));"
      : "window.open('lumagreen-update://'+action+'?token='+token,'_blank');";
  return [
    "(function(){",
    "if(window.top!==window||window.location.origin!==" +
      JSON.stringify(origin) +
      "||!" +
      JSON.stringify(token) +
      String.raw`||/^\/+admin(?:\/|$)/i.test(window.location.pathname))return;`,
    "var token=" + JSON.stringify(token) + ",eventName='luma-app-update';",
    "if(!window.lumaAppUpdates){",
    "var state='unavailable',edited=false,frozen=false,deadline=0,timer;",
    "function changed(){document.dispatchEvent(new Event(eventName));}",
    "function unfreeze(){if(frozen){document.documentElement.inert=false;frozen=false;deadline=0;}clearTimeout(timer);}",
    "function safe(){var path=window.location.pathname,lang=document.documentElement.lang;",
    "return !edited&&!frozen&&document.readyState==='complete'&&!document.hidden&&!window.location.search&&!window.location.hash&&",
    "(path==='/'||path==='/'+lang||path==='/'+lang+'/')&&",
    '!document.querySelector(\'form,input:not([type="hidden"]),textarea,select,[contenteditable="true"],[aria-busy="true"],[role="dialog"]:not([data-app-update-dialog])\');}',
    "function mark(){edited=true;changed();}",
    "document.addEventListener('input',mark,true);document.addEventListener('change',mark,true);document.addEventListener('submit',mark,true);",
    "document.addEventListener('click',function(event){if(!event.target?.closest?.('[data-app-update-control],[data-app-update-dialog]'))mark();},true);",
    "document.addEventListener('luma-shell-update-state',function(event){if(!event.detail||event.detail.token!==token)return;state=event.detail.state;unfreeze();changed();});",
    "function prepare(){if(!safe())return false;frozen=true;deadline=Date.now()+10000;document.documentElement.inert=true;timer=setTimeout(function(){unfreeze();state='failed';changed();},10000);return true;}",
    "var bridge=Object.freeze({getState:function(){return state;},canRestart:safe,prepareRestart:prepare,getRestartDeadline:function(){return frozen?deadline:0;},isRestartPending:function(){return frozen&&Date.now()<deadline;},request:function(action){",
    "if(['status','check','restart'].indexOf(action)<0)return;",
    "if(action==='restart'){if((state!=='ready'&&state!=='blocked')||!prepare()){state='blocked';changed();return;}",
    "}",
    send,
    "}});Object.defineProperty(window,'lumaAppUpdates',{value:bridge,configurable:false,writable:false});}",
    "document.dispatchEvent(new CustomEvent('luma-shell-update-state',{detail:{token:token,state:" +
      JSON.stringify(nextState) +
      "}}));",
    "})();true;",
  ].join("\n");
}

/** @param {string} raw @param {string} frameUrl @param {string} topUrl
 * @param {string} origin @param {string} token */
export function parseMobileUpdate(raw, frameUrl, topUrl, origin, token) {
  if (!token || frameUrl !== topUrl || raw.length > 256) return null;
  try {
    if (
      /\/admin(?:\/|$)/i.test(new URL(topUrl).pathname) ||
      new URL(topUrl).origin !== origin
    )
      return null;
    const value = JSON.parse(raw);
    if (
      !value ||
      typeof value !== "object" ||
      Object.keys(value).length !== 3 ||
      value.type !== "luma.update" ||
      value.nonce !== token ||
      !["status", "check", "restart"].includes(value.action)
    )
      return null;
    return /** @type {'status' | 'check' | 'restart'} */ (value.action);
  } catch {
    return null;
  }
}
