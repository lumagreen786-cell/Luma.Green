/** Documentation adapter only. Never imported by the application build. */
function rejectAccountChange() {
  return Promise.reject(
    new Error("Documentation fixtures cannot change accounts."),
  );
}

export const authClient = {
  signIn: {
    email: () =>
      window.location.pathname.endsWith("/failure.html") &&
      new URLSearchParams(window.location.search).get("scenario") === "totp"
        ? Promise.resolve({ data: { twoFactorRedirect: true }, error: null })
        : rejectAccountChange(),
  },
  signUp: { email: rejectAccountChange },
  // Fictional identity renders account boundaries; it is not a valid auth session.
  useSession: () => ({
    data: {
      fixture: true,
      user: {
        id: "guide-fictional-user",
        email: "guide-fictional@example.test",
        ...(new URLSearchParams(window.location.search).get("phone") ===
          "verified" && { phoneNumber: "+919000000109" }),
        emailVerified: new URLSearchParams(window.location.search).has("phone"),
        phoneNumberVerified:
          new URLSearchParams(window.location.search).get("phone") ===
          "verified",
      },
      session: { id: undefined },
    },
    refetch: rejectAccountChange,
    isPending: false,
    error: null,
  }),
  phoneNumber: { verify: rejectAccountChange, sendOtp: rejectAccountChange },
  signOut: rejectAccountChange,
  requestPasswordReset: rejectAccountChange,
  resetPassword: rejectAccountChange,
  twoFactor: {
    enable: rejectAccountChange,
    disable: rejectAccountChange,
    verifyTotp: rejectAccountChange,
    verifyBackupCode: rejectAccountChange,
    generateBackupCodes: rejectAccountChange,
  },
};
