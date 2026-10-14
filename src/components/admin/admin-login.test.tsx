import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import { AdminLogin } from "./admin-login";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  send: vi.fn(),
  verify: vi.fn(),
}));
vi.mock("@/components/providers/convex-provider", () => ({
  isConvexConfigured: true,
}));
vi.mock("convex/react", () => ({ useQuery: () => null }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("@/lib/phone-auth", () => ({
  requestPhoneCode: mocks.send,
  verifyPhoneCode: mocks.verify,
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.send.mockResolvedValue(null);
});

it("offers only phone verification for admin sign-in", () => {
  render(<AdminLogin />);
  expect(
    screen.getByRole("textbox", { name: "Mobile number" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Send code" })).toBeInTheDocument();
  expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Forgot password?" }),
  ).not.toBeInTheDocument();
});

it("holds admin login at the authenticator after a valid SMS code", async () => {
  mocks.verify.mockResolvedValue({ kind: "second-factor" });
  const user = userEvent.setup();
  render(<AdminLogin />);
  await user.type(screen.getByLabelText("Mobile number"), "9876543210");
  await user.click(screen.getByRole("button", { name: "Send code" }));
  expect(mocks.send).toHaveBeenCalledWith("+919876543210");
  expect(screen.getByRole("button", { name: /Resend in/ })).toBeDisabled();
  await user.type(screen.getByLabelText("Code from your SMS"), "123456");
  await user.click(screen.getByRole("button", { name: "Verify phone" }));
  expect(mocks.verify).toHaveBeenCalledWith("+919876543210", "123456");
  expect(
    screen.getByLabelText("Code from your authenticator app"),
  ).toBeInTheDocument();
  expect(mocks.replace).not.toHaveBeenCalled();
});

it("keeps the phone step available after a failed send", async () => {
  mocks.send.mockResolvedValue("sendFailed");
  const user = userEvent.setup();
  render(<AdminLogin />);
  await user.type(screen.getByLabelText("Mobile number"), "9876543210");
  await user.click(screen.getByRole("button", { name: "Send code" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Could not send");
  expect(screen.getByRole("button", { name: "Send code" })).toBeEnabled();
  expect(screen.queryByLabelText("Code from your SMS")).not.toBeInTheDocument();
});
