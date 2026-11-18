/** Native equivalents of the Afterlife light and dark canvas/action tokens. */
export const themes = {
  light: {
    background: "#f4f8ee",
    foreground: "#14161c",
    primary: "#9bf80f",
    primaryForeground: "#10130a",
    muted: "#f0f3eb",
    border: "#14161c26",
    indicator: "#5a9600",
  },
  dark: {
    background: "#080b14",
    foreground: "#f5f6f8",
    primary: "#9bf80f",
    primaryForeground: "#10130a",
    muted: "#23262f",
    border: "#ffffff26",
    indicator: "#9bf80f",
  },
};

export type NativeAppearance = keyof typeof themes;
export type NativeTheme = typeof themes.light;

/** System appearance is the fallback until the trusted web document reports its theme. */
export function shellAppearance(scheme?: string | null) {
  const appearance: NativeAppearance = scheme === "dark" ? "dark" : "light";
  return {
    colors: themes[appearance],
    statusBar: appearance === "dark" ? ("light" as const) : ("dark" as const),
    appearance,
  };
}

export function appearanceMessage(data: string): NativeAppearance | null {
  if (data === "appearance:light") return "light";
  return data === "appearance:dark" ? "dark" : null;
}

/** Only the trusted top page, after the nonce envelope is installed, may report appearance. */
export function appearanceBridgeScript(origin: string): string {
  return `(function(){
    if(window.top!==window||window.location.origin!==${JSON.stringify(origin)})return;
    var bridge=window.ReactNativeWebView;
    if(!bridge||!bridge.postMessage||!bridge.postMessage.__lumaEnvelope||!document.documentElement)return;
    var report=function(){bridge.postMessage('appearance:'+(document.documentElement.classList.contains('dark')?'dark':'light'));};
    if(!window.__lumaAppearanceObserver){
      window.__lumaAppearanceObserver=new MutationObserver(report);
      window.__lumaAppearanceObserver.observe(document.documentElement,{attributes:true,attributeFilter:['class']});
    }
    report();
  })();true;`;
}
