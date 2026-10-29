import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import { EvidencePage } from "./evidence-page";

const data = vi.hoisted<{
  business: { id: string } | null | undefined;
  canOperate: boolean;
  rows: unknown[];
  status: string;
  loadMore: ReturnType<typeof vi.fn<(count: number) => void>>;
  save: ReturnType<typeof vi.fn<() => Promise<string>>>;
  query: ReturnType<typeof vi.fn<() => void>>;
}>(() => ({
  business: { id: "org-a" },
  canOperate: true,
  rows: [] as unknown[],
  status: "Exhausted",
  loadMore: vi.fn(),
  save: vi.fn(),
  query: vi.fn(),
}));
vi.mock("@/components/shop/use-shop", () => ({
  useBusiness: () => data.business,
}));
vi.mock("@/components/workspace/permissions", () => ({
  useCanOperate: () => data.canOperate,
}));
vi.mock("convex/react", () => ({
  useMutation: () => data.save,
  useQuery: () => ({ buying: [], selling: [] }),
  usePaginatedQuery: () => {
    data.query();
    return { results: data.rows, status: data.status, loadMore: data.loadMore };
  },
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const original = {
  id: "evidence-original",
  orgId: "org-a",
  kind: "gst_invoice",
  reference: "LOCAL-ORIGINAL",
  issuerKind: "external_organization",
  issuerName: "Local synthetic issuer",
  recordedByProfileId: "profile-a",
  createdAt: 1_790_000_000_000,
  version: 1,
  verificationStatus: "reported_unverified",
};
beforeEach(() => {
  data.business = { id: "org-a" };
  data.canOperate = true;
  data.rows = [];
  data.status = "Exhausted";
  data.loadMore.mockReset();
  data.query.mockReset();
  data.save.mockReset();
  data.save.mockResolvedValue("saved-id");
});
function view() {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <EvidencePage />
    </NextIntlClientProvider>
  );
}

it("does not query business references for a personal account", () => {
  data.business = null;
  render(view());
  expect(
    screen.queryByRole("button", { name: messages.evidence.record }),
  ).not.toBeInTheDocument();
  expect(data.query).not.toHaveBeenCalled();
});
it("keeps viewers read-only while showing reported evidence", () => {
  data.canOperate = false;
  data.rows = [original];
  render(view());
  expect(screen.getByText(original.reference)).toBeVisible();
  expect(screen.getByText(/Reported · unverified/)).toBeVisible();
  expect(
    screen.queryByRole("button", { name: messages.evidence.record }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: messages.evidence.correct }),
  ).not.toBeInTheDocument();
});
it("loads another bounded page on request", async () => {
  data.status = "CanLoadMore";
  render(view());
  await userEvent.click(
    screen.getByRole("button", { name: messages.notifications.loadMore }),
  );
  expect(data.loadMore).toHaveBeenCalledWith(20);
});
it("retains entered reference after a failed save, then saves without claiming verification", async () => {
  data.save.mockRejectedValueOnce(new Error("temporary"));
  render(view());
  await userEvent.click(
    screen.getByRole("button", { name: messages.evidence.record }),
  );
  const dialog = screen.getByRole("dialog");
  await userEvent.type(
    within(dialog).getByRole("textbox", { name: messages.evidence.issuerName }),
    "Local synthetic issuer",
  );
  await userEvent.type(
    within(dialog).getByRole("textbox", { name: messages.evidence.reference }),
    "TEST-INVOICE",
  );
  await userEvent.click(
    within(dialog).getByRole("button", { name: messages.lots.save }),
  );
  expect(await within(dialog).findByRole("alert")).toBeVisible();
  expect(
    within(dialog).getByRole("textbox", { name: messages.evidence.reference }),
  ).toHaveValue("TEST-INVOICE");
  await userEvent.click(
    within(dialog).getByRole("button", { name: messages.lots.save }),
  );
  expect(data.save).toHaveBeenLastCalledWith({
    kind: "gst_invoice",
    reference: "TEST-INVOICE",
    issuerKind: "external_organization",
    issuerName: "Local synthetic issuer",
    tradeId: undefined,
    supersedesId: undefined,
  });
});
it("rejects whitespace-only required reference", async () => {
  render(view());
  await userEvent.click(
    screen.getByRole("button", { name: messages.evidence.record }),
  );
  fireEvent.change(
    screen.getByRole("textbox", { name: messages.evidence.issuerName }),
    { target: { value: "Issuer" } },
  );
  fireEvent.change(
    screen.getByRole("textbox", { name: messages.evidence.reference }),
    { target: { value: " ".repeat(3) } },
  );
  await userEvent.click(
    screen.getByRole("button", { name: messages.lots.save }),
  );
  expect(screen.getByRole("alert")).toBeVisible();
  expect(data.save).not.toHaveBeenCalled();
});
it("links a replacement to the original and locks its document kind", async () => {
  data.rows = [original];
  render(view());
  await userEvent.click(
    screen.getByRole("button", { name: messages.evidence.correct }),
  );
  expect(
    screen.getByRole("combobox", { name: messages.evidence.kind }),
  ).toBeDisabled();
  expect(
    screen.queryByRole("combobox", { name: messages.evidence.trade }),
  ).not.toBeInTheDocument();
  await userEvent.type(
    screen.getByRole("textbox", { name: messages.evidence.reference }),
    "LOCAL-CORRECTED",
  );
  await userEvent.click(
    screen.getByRole("button", { name: messages.lots.save }),
  );
  expect(data.save).toHaveBeenCalledWith(
    expect.objectContaining({
      reference: "LOCAL-CORRECTED",
      supersedesId: original.id,
      kind: original.kind,
    }),
  );
  expect(screen.getByText(original.reference)).toBeVisible();
});
it("keeps original history and removes its replace action once a correction is loaded", () => {
  data.rows = [
    {
      ...original,
      id: "replacement",
      reference: "LOCAL-CORRECTED",
      supersedesId: original.id,
    },
    original,
  ];
  render(view());
  expect(screen.getByText("Replaces: LOCAL-ORIGINAL")).toBeVisible();
  expect(
    screen.getAllByRole("button", { name: messages.evidence.correct }),
  ).toHaveLength(1);
});

it("downloads an explicitly partial unfiled list without saving or reading more rows and revokes its local URL", async () => {
  const createUrl = vi.fn(() => "blob:synthetic-evidence-list"),
    revokeUrl = vi.fn();
  const NativeUrl = URL;
  vi.stubGlobal(
    "URL",
    class extends NativeUrl {
      static readonly createObjectURL = createUrl;
      static readonly revokeObjectURL = revokeUrl;
    },
  );
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(vi.fn());
  try {
    data.rows = [original];
    data.status = "CanLoadMore";
    render(view());
    expect(screen.getByText(messages.evidence.export.partial)).toBeVisible();
    expect(screen.getByText(messages.evidence.export.notice)).toBeVisible();
    await userEvent.click(
      screen.getByRole("button", { name: messages.evidence.export.download }),
    );
    expect(createUrl).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeUrl).toHaveBeenCalledWith("blob:synthetic-evidence-list");
    expect(data.save).not.toHaveBeenCalled();
    expect(data.loadMore).not.toHaveBeenCalled();
  } finally {
    click.mockRestore();
    vi.unstubAllGlobals();
  }
});

it("disables evidence downloads while scoped rows are loading or belong to another workspace", () => {
  data.rows = [{ ...original, orgId: "different-workspace" }];
  render(view());
  expect(
    screen.getByRole("button", { name: messages.evidence.export.download }),
  ).toBeDisabled();
});
