import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminLogin } from "./admin-login";
import { AdminSetup } from "./admin-setup";
import { AuthenticatorStep } from "./authenticator-step";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  enable: vi.fn(),
  verify: vi.fn(),
  backup: vi.fn(),
  replace: vi.fn(),
  me: null as null | {
    kind: "admin";
    adminName: string;
    twoFactorEnabled: boolean;
  },
}));
vi.mock("@/components/providers/convex-provider", () => ({
  isConvexConfigured: true,
}));
vi.mock("@/components/notifications/device-provider", () => ({
  lockDeviceSignOut: () => vi.fn(),
  revokeCurrentDevice: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useQuery: (query: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(query) === "identity:me"
      ? mocks.me
      : { adminSetup: true, phone: true },
  useMutation: () => vi.fn(),
  useConvexAuth: () => ({ isAuthenticated: Boolean(mocks.me) }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: {
        session: { id: "fixture-session" },
        user: { id: "fixture-user" },
      },
    }),
    signIn: { email: mocks.signIn },
    signUp: { email: mocks.signUp },
    twoFactor: {
      enable: mocks.enable,
      verifyTotp: mocks.verify,
      verifyBackupCode: mocks.backup,
    },
  },
}));
vi.mock("@/lib/phone-auth", () => ({
  requestPhoneCode: mocks.send,
  verifyPhoneCode: mocks.signIn,
}));
vi.mock("qrcode", () => ({
  default: { toDataURL: () => Promise.resolve("") },
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.me = null;
  mocks.send.mockResolvedValue(null);
});
async function phoneStep() {
  fireEvent.change(screen.getByLabelText("Mobile number"), {
    target: { value: "9000000000" },
  });
  await userEvent.click(screen.getByRole("button", { name: "Send code" }));
  fireEvent.change(screen.getByLabelText("Code from your SMS"), {
    target: { value: "123456" },
  });
  await userEvent.click(screen.getByRole("button", { name: "Verify phone" }));
}

describe("admin request failures", () => {
  it("permits a second send after a safe delivery error", async () => {
    mocks.send.mockResolvedValueOnce("sendFailed");
    render(<AdminLogin />);
    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "9000000000" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Send code" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not send",
    );
    await userEvent.click(screen.getByRole("button", { name: "Send code" }));
    expect(screen.getByLabelText("Code from your SMS")).toBeEnabled();
  });

  it.each(["totp", "backup"])(
    "releases %s controls after a rejected verification",
    async (mode) => {
      mocks.signIn.mockResolvedValue({
        kind: "second-factor",
      });
      mocks.verify.mockRejectedValueOnce(new Error("Offline"));
      mocks.backup.mockRejectedValueOnce(new Error("Offline"));
      render(<AdminLogin />);
      await phoneStep();
      if (mode === "backup") {
        await userEvent.click(
          screen.getByRole("button", { name: "Use a backup code" }),
        );
        fireEvent.change(screen.getByLabelText("Backup code"), {
          target: { value: "example-backup" },
        });
        await userEvent.click(
          screen.getByRole("button", { name: /^Sign in$/ }),
        );
      } else {
        fireEvent.change(
          screen.getByLabelText("Code from your authenticator app"),
          { target: { value: "123456" } },
        );
      }
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Something went wrong. Try again.",
      );
      expect(screen.getByRole("button", { name: "Start again" })).toBeEnabled();
      expect(
        screen.getByLabelText(
          mode === "backup"
            ? "Backup code"
            : "Code from your authenticator app",
        ),
      ).toBeEnabled();
      expect(mocks.replace).not.toHaveBeenCalled();
    },
  );

  it("does not leave enrolment locked after a rejected authenticator code", async () => {
    mocks.verify.mockRejectedValueOnce(new Error("Offline"));
    const onVerified = vi.fn();
    render(
      <AuthenticatorStep
        totpURI="otpauth://totp/Fixture"
        onVerified={onVerified}
      />,
    );
    fireEvent.change(screen.getByLabelText("Code from the app"), {
      target: { value: "123456" },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Try again.",
    );
    expect(screen.getByLabelText("Code from the app")).toBeEnabled();
    expect(onVerified).not.toHaveBeenCalled();
  });

  it("requires phone sign-in before setup and does not offer email signup", () => {
    render(<AdminSetup />);
    expect(
      screen.getByRole("link", { name: "Go to phone sign-in" }),
    ).toHaveAttribute("href", "/admin/login");
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Setup token")).not.toBeInTheDocument();
  });

  it("allows retry when resuming authenticator enrolment fails", async () => {
    mocks.me = {
      kind: "admin",
      adminName: "Fixture Admin",
      twoFactorEnabled: false,
    };
    mocks.enable.mockRejectedValueOnce(new Error("Private server failure"));
    render(<AdminSetup />);
    await userEvent.click(
      screen.getByRole("button", { name: "Connect authenticator" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not start authenticator setup. Try again.",
    );
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Connect authenticator" }),
      ).toBeEnabled();
    });
  });
});

it("does not navigate after an admin phone verification outlives login", async () => {
  const pending = Promise.withResolvers<{ kind: "authenticated" }>();
  mocks.signIn.mockReturnValueOnce(pending.promise);
  const view = render(<AdminLogin />);
  await phoneStep();
  view.unmount();
  await act(async () => {
    pending.resolve({ kind: "authenticated" });
    await pending.promise;
  });
  expect(mocks.replace).not.toHaveBeenCalled();
});
it.each(["totp", "backup"])(
  "does not navigate after an admin %s verification outlives login",
  async (mode) => {
    mocks.signIn.mockResolvedValueOnce({ kind: "second-factor" });
    const user = userEvent.setup();
    const view = render(<AdminLogin />);
    await phoneStep();
    const pending = Promise.withResolvers<{ error: null }>();
    if (mode === "backup") {
      await user.click(
        screen.getByRole("button", { name: /Use a backup code/ }),
      );
      await user.type(screen.getByLabelText("Backup code"), "synthetic-code");
      mocks.backup.mockReturnValueOnce(pending.promise);
    } else {
      fireEvent.change(
        screen.getByLabelText("Code from your authenticator app"),
        { target: { value: "123456" } },
      );
      mocks.verify.mockReturnValueOnce(pending.promise);
    }
    if (mode === "backup")
      await user.click(screen.getByRole("button", { name: "Sign in" }));
    view.unmount();
    await act(async () => {
      pending.resolve({ error: null });
      await pending.promise;
    });
    expect(mocks.replace).not.toHaveBeenCalled();
  },
);
it("does not complete enrolment after its authenticator form unmounts", async () => {
  const done = vi.fn();
  const pending = Promise.withResolvers<{ error: null }>();
  mocks.verify.mockReturnValueOnce(pending.promise);
  const view = render(
    <AuthenticatorStep
      totpURI="otpauth://totp/Luma?secret=JBSWY3DPEHPK3PXP"
      onVerified={done}
    />,
  );
  fireEvent.change(screen.getByLabelText("Code from the app"), {
    target: { value: "123456" },
  });
  view.unmount();
  await act(async () => {
    pending.resolve({ error: null });
    await pending.promise;
  });
  expect(done).not.toHaveBeenCalled();
});
