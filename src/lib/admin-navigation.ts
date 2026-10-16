/** Admin routes are outside the locale tree; do not prefix them with a locale. */
export function navigateToAdmin(isTwoFactorEnabled: boolean) {
  window.location.replace(isTwoFactorEnabled ? "/admin" : "/admin/setup");
}
