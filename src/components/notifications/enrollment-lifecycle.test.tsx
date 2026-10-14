import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";

import { AccountSecurity } from "@/components/account/account-security";
import { AdminSetup } from "@/components/admin/admin-setup";

import messages from "../../../messages/en.json";
import {
  NotificationDeviceProvider,
  NotificationRevocationProvider,
} from "./device-provider";

interface Identity {
  kind: "admin" | "member";
  hasProfile: boolean;
  hasPassword: boolean;
  twoFactorEnabled: boolean;
  adminName?: string;
}
interface MockState {
  authenticated: boolean;
  settings: { webKey: string | null; expo: boolean };
  me: Identity | null;
  session: { data: { session: { id: string }; user: { id: string } } | null };
  signup: ReturnType<typeof vi.fn<() => Promise<{ error: null }>>>;
  profile: ReturnType<typeof vi.fn>;
  enable: ReturnType<typeof vi.fn>;
  verify: ReturnType<typeof vi.fn>;
  replace: ReturnType<typeof vi.fn>;
  mutate: ReturnType<typeof vi.fn>;
}
const mocks = vi.hoisted((): MockState => ({
  authenticated: true,
  settings: { webKey: null, expo: false },
  me: null,
  session: {
    data: { session: { id: "session-before" }, user: { id: "person-a" } },
  },
  signup: vi.fn<() => Promise<{ error: null }>>(),
  profile: vi.fn(),
  enable: vi.fn(),
  verify: vi.fn(),
  replace: vi.fn(),
  mutate: vi.fn(),
}));
vi.mock("@/components/providers/convex-provider", () => ({
  isConvexConfigured: true,
}));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isAuthenticated: mocks.authenticated,
    isLoading: false,
  }),
  useQuery: (query: Parameters<typeof getFunctionName>[0]) => {
    switch (getFunctionName(query)) {
      case "identity:me": {
        return mocks.me;
      }
      case "identity:signInOptions": {
        return { adminSetup: true };
      }
      case "push:settings": {
        return mocks.settings;
      }
      default: {
        throw new Error("Unexpected enrollment query");
      }
    }
  },
  useMutation: (mutation: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(mutation) === "identity:saveAdminProfile"
      ? mocks.profile
      : mocks.mutate,
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => mocks.session,
    signUp: { email: mocks.signup },
    twoFactor: { enable: mocks.enable, verifyTotp: mocks.verify },
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: "a",
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("qrcode", () => ({
  default: { toDataURL: () => Promise.resolve("") },
}));

const password = "Fixture-password-1234";
const backup = "fixture-backup-code";
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  mocks.authenticated = true;
  mocks.me = {
    kind: "admin",
    hasProfile: true,
    hasPassword: true,
    twoFactorEnabled: false,
    adminName: "Fixture Admin",
  };
  mocks.session = {
    data: { session: { id: crypto.randomUUID() }, user: { id: "person-a" } },
  };
  mocks.enable.mockResolvedValue({
    error: null,
    data: {
      totpURI: "otpauth://totp/Fixture?secret=TESTONLY",
      backupCodes: [backup],
    },
  });
  mocks.mutate.mockResolvedValue(null);
});
function AdminApp() {
  return (
    <NotificationRevocationProvider>
      <AdminSetup />
    </NotificationRevocationProvider>
  );
}
function MemberApp() {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <NotificationDeviceProvider>
        <AccountSecurity />
      </NotificationDeviceProvider>
    </NextIntlClientProvider>
  );
}

it.each([false, true])(
  "handles profile completion without carrying pending admin enrollment into a different identity: %s",
  async (changeIdentity) => {
    mocks.me = {
      kind: "admin",
      hasProfile: false,
      hasPassword: false,
      twoFactorEnabled: false,
    };
    const profile = Promise.withResolvers<null>();
    mocks.profile.mockReturnValue(profile.promise);
    const view = render(<AdminApp />);
    const fields = {
      "Full name": "Fixture Admin",
      "Mobile number": "9000000000",
      "Date of birth": "1990-01-01",
      "Last four digits of your Aadhaar": "0000",
    };
    for (const [label, value] of Object.entries(fields))
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    await userEvent.click(
      screen.getByRole("button", { name: "Save and continue" }),
    );
    await waitFor(() => {
      expect(mocks.profile).toHaveBeenCalledOnce();
    });
    mocks.me = {
      kind: "admin",
      hasProfile: true,
      hasPassword: true,
      twoFactorEnabled: false,
      adminName: "Fixture Admin",
    };
    view.rerender(<AdminApp />);
    if (changeIdentity) {
      mocks.me = {
        kind: "member",
        hasProfile: true,
        hasPassword: true,
        twoFactorEnabled: false,
      };
      mocks.session = {
        data: {
          session: { id: crypto.randomUUID() },
          user: { id: "person-b" },
        },
      };
      view.rerender(<AdminApp />);
    }
    await act(async () => {
      profile.resolve(null);
      await profile.promise;
    });
    if (changeIdentity) {
      expect(mocks.enable).not.toHaveBeenCalled();
      expect(
        screen.queryByLabelText("Code from the app"),
      ).not.toBeInTheDocument();
      return;
    }
    await userEvent.click(
      screen.getByRole("button", { name: "Connect authenticator" }),
    );
    expect(mocks.enable).toHaveBeenCalledExactlyOnceWith({});
    expect(await screen.findByLabelText("Code from the app")).toBeVisible();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(screen.queryByText(backup)).not.toBeInTheDocument();
  },
);

it("keeps admin backup codes until acknowledged when first TOTP verification rotates the session", async () => {
  const verify = Promise.withResolvers<{ error: null }>();
  mocks.verify.mockReturnValue(verify.promise);
  const view = render(<AdminApp />);
  await userEvent.click(
    screen.getByRole("button", { name: "Connect authenticator" }),
  );
  fireEvent.change(await screen.findByLabelText("Code from the app"), {
    target: { value: "123456" },
  });
  await waitFor(() => {
    expect(mocks.verify).toHaveBeenCalledOnce();
  });
  mocks.me = {
    kind: "admin",
    hasProfile: true,
    hasPassword: true,
    twoFactorEnabled: true,
    adminName: "Fixture Admin",
  };
  mocks.session = {
    data: { session: { id: crypto.randomUUID() }, user: { id: "person-a" } },
  };
  view.rerender(<AdminApp />);
  await act(async () => {
    verify.resolve({ error: null });
    await verify.promise;
  });
  expect(screen.getByRole("list", { name: "Backup codes" })).toHaveTextContent(
    backup,
  );
  expect(mocks.replace).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: "Go to the console" }),
  ).toBeDisabled();
  await userEvent.click(
    screen.getByRole("checkbox", {
      name: "I've stored these codes somewhere safe.",
    }),
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Go to the console" }),
  );
  expect(mocks.replace).toHaveBeenCalledWith("/admin");
});

it("preserves account security enrollment and recovery codes across session rotation", async () => {
  mocks.me = {
    kind: "member",
    hasProfile: true,
    hasPassword: true,
    twoFactorEnabled: false,
  };
  const verify = Promise.withResolvers<{ error: null }>();
  mocks.verify.mockReturnValue(verify.promise);
  const view = render(<MemberApp />);
  await userEvent.type(
    screen.getByLabelText(messages.emailAuth.password),
    password,
  );
  await userEvent.click(
    screen.getByRole("button", { name: messages.accountSecurity.enable }),
  );
  expect(screen.queryByText(backup)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(messages.auth.codeLabel), {
    target: { value: "123456" },
  });
  await userEvent.click(
    screen.getByRole("button", { name: messages.auth.verify }),
  );
  mocks.me = {
    kind: "member",
    hasProfile: true,
    hasPassword: true,
    twoFactorEnabled: true,
  };
  mocks.session = {
    data: { session: { id: crypto.randomUUID() }, user: { id: "person-a" } },
  };
  view.rerender(<MemberApp />);
  await act(async () => {
    verify.resolve({ error: null });
    await verify.promise;
  });
  expect(screen.getByText(backup)).toBeVisible();
  expect(JSON.stringify(localStorage)).not.toContain(backup);
  expect(JSON.stringify(sessionStorage)).not.toContain(backup);
  await userEvent.click(
    screen.getByRole("button", { name: messages.accountSecurity.savedCodes }),
  );
  expect(screen.queryByText(backup)).not.toBeInTheDocument();
});

it.each(["signed-out", "person-b"])(
  "clears account secrets after identity changes to %s",
  async (nextIdentity) => {
    mocks.me = {
      kind: "member",
      hasProfile: true,
      hasPassword: true,
      twoFactorEnabled: false,
    };
    mocks.verify.mockResolvedValue({ error: null });
    const view = render(<MemberApp />);
    await userEvent.type(
      screen.getByLabelText(messages.emailAuth.password),
      password,
    );
    await userEvent.click(
      screen.getByRole("button", { name: messages.accountSecurity.enable }),
    );
    fireEvent.change(screen.getByLabelText(messages.auth.codeLabel), {
      target: { value: "123456" },
    });
    await userEvent.click(
      screen.getByRole("button", { name: messages.auth.verify }),
    );
    expect(screen.getByText(backup)).toBeVisible();
    if (nextIdentity === "signed-out") {
      mocks.authenticated = false;
      mocks.me = null;
      mocks.session = { data: null };
    } else {
      mocks.session = {
        data: {
          session: { id: crypto.randomUUID() },
          user: { id: nextIdentity },
        },
      };
    }
    view.rerender(<MemberApp />);
    expect(screen.queryByText(backup)).not.toBeInTheDocument();
    expect(screen.queryByText("TESTONLY")).not.toBeInTheDocument();
    if (nextIdentity === "signed-out") {
      mocks.authenticated = true;
      mocks.me = {
        kind: "member",
        hasProfile: true,
        hasPassword: true,
        twoFactorEnabled: false,
      };
      mocks.session = {
        data: {
          session: { id: crypto.randomUUID() },
          user: { id: "person-a" },
        },
      };
      view.rerender(<MemberApp />);
      expect(screen.queryByText(backup)).not.toBeInTheDocument();
    }
    expect(screen.getByLabelText(messages.emailAuth.password)).toHaveValue("");
  },
);

it("does not publish a previous person's late enrollment response in the current account", async () => {
  mocks.me = {
    kind: "member",
    hasProfile: true,
    hasPassword: true,
    twoFactorEnabled: false,
  };
  const enable = Promise.withResolvers<{
    error: null;
    data: { totpURI: string; backupCodes: string[] };
  }>();
  mocks.enable.mockReturnValue(enable.promise);
  const view = render(<MemberApp />);
  await userEvent.type(
    screen.getByLabelText(messages.emailAuth.password),
    password,
  );
  await userEvent.click(
    screen.getByRole("button", { name: messages.accountSecurity.enable }),
  );
  mocks.session = {
    data: { session: { id: crypto.randomUUID() }, user: { id: "person-b" } },
  };
  view.rerender(<MemberApp />);
  expect(screen.getByLabelText(messages.emailAuth.password)).toHaveValue("");
  await act(async () => {
    enable.resolve({
      error: null,
      data: {
        totpURI: "otpauth://totp/Fixture?secret=TESTONLY",
        backupCodes: [backup],
      },
    });
    await enable.promise;
  });
  expect(screen.queryByText("TESTONLY")).not.toBeInTheDocument();
  expect(screen.queryByText(backup)).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: messages.accountSecurity.enable }),
  ).toBeEnabled();
});

it("clears admin enrollment when a different person signs in", async () => {
  const view = render(<AdminApp />);
  await userEvent.click(
    screen.getByRole("button", { name: "Connect authenticator" }),
  );
  expect(screen.getByText("TEST ONLY")).toBeVisible();
  mocks.me = {
    kind: "member",
    hasProfile: true,
    hasPassword: true,
    twoFactorEnabled: false,
  };
  mocks.session = {
    data: { session: { id: crypto.randomUUID() }, user: { id: "person-b" } },
  };
  view.rerender(<AdminApp />);
  expect(screen.queryByText("TESTONLY")).not.toBeInTheDocument();
  expect(screen.queryByText(backup)).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Code from the app")).not.toBeInTheDocument();
  expect(screen.queryByText("TEST ONLY")).not.toBeInTheDocument();
});

it("discards a late admin enrollment response after the identity changes", async () => {
  const pending = Promise.withResolvers<{
    error: null;
    data: { totpURI: string; backupCodes: string[] };
  }>();
  mocks.enable.mockReturnValue(pending.promise);
  const view = render(<AdminApp />);
  await userEvent.click(
    screen.getByRole("button", { name: "Connect authenticator" }),
  );
  mocks.session = {
    data: { session: { id: "other-session" }, user: { id: "person-b" } },
  };
  view.rerender(<AdminApp />);
  await act(async () => {
    pending.resolve({
      error: null,
      data: {
        totpURI: "otpauth://totp/Fixture?secret=TESTONLY",
        backupCodes: [backup],
      },
    });
    await pending.promise;
  });
  expect(screen.queryByLabelText("Code from the app")).not.toBeInTheDocument();
  expect(screen.queryByText(backup)).not.toBeInTheDocument();
});
