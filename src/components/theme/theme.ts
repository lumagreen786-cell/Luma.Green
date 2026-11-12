export type ThemePreference = "light" | "dark" | "system";
export const themeStorageKey = "luma-theme";
export function parseTheme(value: unknown): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}
/** Apply the stored preference before React; storage denial uses device appearance. */
export const themeBootstrap = `(()=>{let p="system";try{p=localStorage.getItem("luma-theme")||"system"}catch{}const d=p==="dark"||(p!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light"})()`;
