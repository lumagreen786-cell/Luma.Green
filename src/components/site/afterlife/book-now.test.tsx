import { render, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "../../../../messages/en.json";
import { BookNow } from "./book-now";
const config = vi.hoisted(() => ({ NEXT_PUBLIC_WHATSAPP_NUMBER: "" }));
vi.mock("@/lib/env", () => ({ clientEnv: config }));
vi.mock("next-intl/server", () => ({
  getTranslations: () =>
    Promise.resolve(
      createTranslator({ locale: "en", messages, namespace: "afterlife" }),
    ),
}));
afterEach(() => {
  config.NEXT_PUBLIC_WHATSAPP_NUMBER = "";
});
describe("Book now", () => {
  it("renders a direct WhatsApp anchor without a dialog when configured", async () => {
    config.NEXT_PUBLIC_WHATSAPP_NUMBER = "919876543210";
    render(await BookNow());
    expect(screen.getByRole("link", { name: "Book now" })).toHaveAttribute(
      "href",
      `https://wa.me/919876543210?text=${encodeURIComponent(messages.afterlife.bookingMessage)}`,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("does not send users to a placeholder recipient", async () => {
    render(await BookNow());
    expect(screen.getByRole("button", { name: "Book now" })).toBeDisabled();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
