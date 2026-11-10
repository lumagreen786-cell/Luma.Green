/** Native equivalents of the approved light-only Luma palette. */
export const themes = {
  light: {
    background: "#FFFFFF",
    foreground: "#144419",
    primary: "#317F38",
    primaryForeground: "#FFFFFF",
    muted: "rgba(20, 68, 25, 0.07)",
    border: "rgba(20, 68, 25, 0.13)",
    indicator: "#317F38",
  },
};

export type NativeTheme = typeof themes.light;

/** Keep shell chrome light, including when the device uses dark appearance. */
export function shellAppearance() {
  return {
    colors: themes.light,
    statusBar: "dark" as const,
    appearance: "light" as const,
  };
}
