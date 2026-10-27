import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexError } from "convex/values";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import { StockReport } from "./stock-report";

const state = vi.hoisted(() => ({
  request: vi.fn(),
  user: "person-one",
  org: "workspace-one",
  job: null as null | {
    id: string;
    status: "complete" | "expired" | "queued";
    progress: number;
    expiresAt: number;
    result: string | null;
  },
}));
vi.mock("convex/react", () => ({
  useAction: () => state.request,
  useQuery: (_reference: unknown, args: unknown) =>
    args === "skip" ? undefined : state.job,
}));
vi.mock("./use-shop", () => ({ useBusiness: () => ({ id: state.org }) }));
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: { user: { id: state.user } } }) },
}));

function Example() {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <StockReport />
    </NextIntlClientProvider>
  );
}
beforeEach(() => {
  state.request.mockReset();
  state.user = "person-one";
  state.org = "workspace-one";
  state.job = null;
});
describe("private stock report controls", () => {
  it("shows unavailable without pretending that a report was prepared", async () => {
    state.request.mockRejectedValue(new ConvexError("JOBS_UNAVAILABLE"));
    const user = userEvent.setup();
    render(<Example />);
    await user.click(
      screen.getByRole("button", { name: messages.stockReports.prepare }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      messages.stockReports.unavailable,
    );
    expect(
      screen.queryByRole("button", { name: messages.stockReports.download }),
    ).not.toBeInTheDocument();
  });
  it("reuses the operation key after an ambiguous request error", async () => {
    state.request.mockRejectedValue(new Error("Disconnected"));
    const user = userEvent.setup();
    render(<Example />);
    await user.click(
      screen.getByRole("button", { name: messages.stockReports.prepare }),
    );
    await screen.findByRole("alert");
    await user.click(
      screen.getByRole("button", { name: messages.stockReports.prepare }),
    );
    expect(state.request).toHaveBeenCalledTimes(2);
    expect(state.request.mock.calls[0]?.[0]).toEqual(
      state.request.mock.calls[1]?.[0],
    );
  });
  it("clears a ready private result when the account changes", async () => {
    state.request.mockResolvedValue("job-one");
    state.job = {
      id: "job-one",
      status: "complete",
      progress: 100,
      expiresAt: Date.now() + 60_000,
      result: "material,grams\nPAPER,1000\n",
    };
    const user = userEvent.setup();
    const view = render(<Example />);
    await user.click(
      screen.getByRole("button", { name: messages.stockReports.prepare }),
    );
    expect(
      await screen.findByRole("button", {
        name: messages.stockReports.download,
      }),
    ).toBeVisible();
    state.user = "person-two";
    view.rerender(<Example />);
    expect(
      screen.queryByRole("button", { name: messages.stockReports.download }),
    ).not.toBeInTheDocument();
  });
  it("does not show a late request result in another workspace", async () => {
    const deferred = Promise.withResolvers<string>();
    state.request.mockReturnValue(deferred.promise);
    const user = userEvent.setup();
    const view = render(<Example />);
    await user.click(
      screen.getByRole("button", { name: messages.stockReports.prepare }),
    );
    state.org = "workspace-two";
    view.rerender(<Example />);
    await act(async () => {
      deferred.resolve("old-workspace-job");
      await deferred.promise;
    });
    expect(
      screen.queryByRole("button", { name: messages.stockReports.download }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: messages.stockReports.prepare }),
    ).toBeEnabled();
  });
  it("hides downloads after expiry even if an old result remains in memory", async () => {
    state.request.mockResolvedValue("job-one");
    state.job = {
      id: "job-one",
      status: "complete",
      progress: 100,
      expiresAt: Date.now() - 60_000,
      result: "material,grams\nPAPER,1000\n",
    };
    const user = userEvent.setup();
    render(<Example />);
    await user.click(
      screen.getByRole("button", { name: messages.stockReports.prepare }),
    );
    expect(
      await screen.findByText(messages.stockReports.expired),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: messages.stockReports.download }),
    ).not.toBeInTheDocument();
  });
});
