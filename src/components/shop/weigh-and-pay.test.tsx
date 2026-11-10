import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Id } from "../../../convex/_generated/dataModel";
import arabic from "../../../messages/ar.json";
import italian from "../../../messages/it.json";
import tamil from "../../../messages/ta.json";
import urdu from "../../../messages/ur.json";
import { IRON, NEWSPAPER, PET, renderWithIntl } from "./test-helpers";
import { WeighAndPay } from "./weigh-and-pay";

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useMutation: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const complete = vi.fn();

beforeEach(() => {
  complete.mockReset();
  complete.mockResolvedValue({ totalPaise: 0, points: 0 });
  vi.mocked(useMutation).mockReturnValue(
    complete as unknown as ReturnType<typeof useMutation>,
  );
});

const BOOKING_ID = "booking-1" as Id<"bookings">;
const RATES = new Map([
  ["PAPER-NEWS", 1450],
  ["PLASTIC-PET", 2100],
  ["METAL-IRON", 2900],
]);

function renderScale() {
  renderWithIntl(
    <WeighAndPay
      bookingId={BOOKING_ID}
      items={[
        { material: NEWSPAPER, estKg: 12 },
        { material: PET, estKg: 3 },
      ]}
      rates={RATES}
      choices={[NEWSPAPER, PET, IRON]}
    />,
  );
}

const newspaperKg = () =>
  screen.getByRole("textbox", { name: "Newspaper, in kg" });

describe("WeighAndPay", () => {
  it.each([
    { locale: "ar", messages: arabic },
    { locale: "ur", messages: urdu },
  ])(
    "keeps the $locale material picker and menu right to left",
    async ({ locale, messages }) => {
      render(
        <NextIntlClientProvider
          locale={locale}
          messages={messages}
          timeZone="Asia/Kolkata"
        >
          <WeighAndPay
            bookingId={BOOKING_ID}
            items={[]}
            rates={RATES}
            choices={[IRON]}
          />
        </NextIntlClientProvider>,
      );
      const picker = screen.getByRole("combobox", {
        name: messages.shop.weigh.add,
      });
      expect(picker).toHaveAttribute("dir", "rtl");
      await userEvent.click(picker);
      expect(screen.getByRole("listbox")).toHaveAttribute("dir", "rtl");
      await userEvent.click(screen.getByRole("option"));
      expect(screen.getByRole("textbox")).toHaveFocus();
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
      expect(complete).not.toHaveBeenCalled();
    },
  );

  it.each([
    { locale: "ta", messages: tamil, confirmation: /^₹237 கொடுத்தேன்$/ },
    {
      locale: "it",
      messages: italian,
      confirmation: /^Conferma 237\sINR pagati$/,
    },
  ])(
    "keeps the amount and payment action explicit in $locale",
    async ({ locale, messages, confirmation }) => {
      render(
        <NextIntlClientProvider
          locale={locale}
          messages={messages}
          timeZone="Asia/Kolkata"
        >
          <WeighAndPay
            bookingId={BOOKING_ID}
            items={[
              { material: NEWSPAPER, estKg: 12 },
              { material: PET, estKg: 3 },
            ]}
            rates={RATES}
            choices={[NEWSPAPER, PET, IRON]}
          />
        </NextIntlClientProvider>,
      );
      expect(
        screen.getByRole("combobox", { name: messages.shop.weigh.add }),
      ).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: confirmation }));
      expect(complete).toHaveBeenCalledWith({
        bookingId: BOOKING_ID,
        lines: [
          { materialCode: "PAPER-NEWS", grams: 12_000 },
          { materialCode: "PLASTIC-PET", grams: 3000 },
        ],
        method: "cash",
      });
    },
  );

  it("starts from the household's guess and totals at the shop's prices", () => {
    renderScale();
    expect(newspaperKg()).toHaveValue("12");
    expect(
      screen.getByRole("textbox", { name: "PET bottles, in kg" }),
    ).toHaveValue("3");
    // 12 kg × ₹14.50 + 3 kg × ₹21 = ₹174 + ₹63.
    expect(
      screen.getByRole("button", { name: "Confirm ₹237 paid" }),
    ).toBeInTheDocument();
  });

  it("updates the amount as the weight is typed or stepped", async () => {
    const user = userEvent.setup();
    renderScale();

    await user.clear(newspaperKg());
    await user.type(newspaperKg(), "10.5");
    // 10.5 kg × ₹14.50 = ₹152.25, plus ₹63.
    expect(
      screen.getByRole("button", { name: "Confirm ₹215.25 paid" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Half a kilo more Newspaper" }),
    );
    expect(newspaperKg()).toHaveValue("11");
    await user.click(
      screen.getByRole("button", { name: "Half a kilo less Newspaper" }),
    );
    expect(newspaperKg()).toHaveValue("10.5");
  });

  it("records the weighed grams and the direct cash payment", async () => {
    const user = userEvent.setup();
    renderScale();

    await user.clear(newspaperKg());
    await user.type(newspaperKg(), "11.25");
    expect(
      screen.queryByRole("radio", { name: "UPI" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Confirm/ }));

    expect(complete).toHaveBeenCalledWith({
      bookingId: BOOKING_ID,
      lines: [
        { materialCode: "PAPER-NEWS", grams: 11_250 },
        { materialCode: "PLASTIC-PET", grams: 3000 },
      ],
      method: "cash",
    });
  });

  it("adds a material the household didn't mention, ready to weigh", async () => {
    const user = userEvent.setup();
    renderScale();

    await user.click(
      screen.getByRole("combobox", { name: "Add another material" }),
    );
    await user.click(screen.getByRole("option", { name: "Iron and steel" }));

    const iron = screen.getByRole("textbox", { name: "Iron and steel, in kg" });
    expect(iron).toHaveFocus();
    await user.type(iron, "4");
    // ₹237 so far, plus 4 kg × ₹29.
    expect(
      screen.getByRole("button", { name: "Confirm ₹353 paid" }),
    ).toBeInTheDocument();
    // Everything the shop buys is on the scale now.
    expect(
      screen.queryByRole("combobox", { name: "Add another material" }),
    ).not.toBeInTheDocument();
  });

  it("leaves out materials weighed at zero, and needs at least one", async () => {
    const user = userEvent.setup();
    renderScale();

    await user.clear(newspaperKg());
    await user.click(
      screen.getByRole("button", { name: "Remove PET bottles" }),
    );
    await user.click(screen.getByRole("button", { name: /^Confirm/ }));

    expect(complete).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Weigh at least one material.",
    );
  });

  it("won't send a weight it can't read", async () => {
    const user = userEvent.setup();
    renderScale();

    await user.clear(newspaperKg());
    await user.type(newspaperKg(), "twelve");

    expect(newspaperKg()).toHaveAccessibleDescription(
      "Enter kilograms, like 12 or 12.5.",
    );
    await user.click(screen.getByRole("button", { name: /^Confirm/ }));
    expect(complete).not.toHaveBeenCalled();
  });

  it("says so when the request changed before the payment was saved", async () => {
    const user = userEvent.setup();
    complete.mockRejectedValueOnce(new ConvexError("WRONG_STATUS"));
    renderScale();

    await user.click(screen.getByRole("button", { name: /^Confirm/ }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "This request changed in the meantime. Check it again.",
      );
    });
  });
});

vi.mock("@/components/workspace/permissions", () => ({
  useCanOperate: () => true,
}));
