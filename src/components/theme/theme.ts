export type ThemePreference = "light";

export const themeStorageKey = "luma-theme";

export function parseTheme(_value: unknown): ThemePreference {
  return "light";
}

/** Apply the approved appearance before React and without storage access. */
export const themeBootstrap = `(()=>{document.documentElement.classList.remove("dark");document.documentElement.style.colorScheme="light"})()`;
