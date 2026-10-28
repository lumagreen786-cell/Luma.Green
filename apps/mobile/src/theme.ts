import type { ColorSchemeName } from "react-native";

/** sRGB equivalents of the semantic tokens in src/app/globals.css.
 * The drift test checks conversion from the owning web tokens.
 */
export const themes = {
  light: {
    background: "#f9fafb",
    foreground: "#181b1e",
    primary: "#125139",
    primaryForeground: "#fcfcfc",
    muted: "#eef0f3",
    border: "#dcdfe2",
  },
  dark: {
    background: "#0d0e10",
    foreground: "#eff1f2",
    primary: "#74c8a2",
    primaryForeground: "#0a140f",
    muted: "#1f2224",
    border: "#303336",
  },
};

export type NativeTheme = typeof themes.light;

/** Native chrome follows the OS; a manual web theme stays inside the WebView. */
export function shellAppearance(scheme: ColorSchemeName | null | undefined) {
  const appearance: keyof typeof themes = scheme === "dark" ? "dark" : "light";
  return {
    colors: themes[appearance],
    statusBar: appearance === "dark" ? ("light" as const) : ("dark" as const),
    appearance,
  };
}
