import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

import type { Id } from "../../../convex/_generated/dataModel";
import messages from "../../../messages/en.json";
import { PaperEditor, PaperPage } from "./paper-page";
const mocks = vi.hoisted(() => ({
  business: { id: "workspace-a" },
  upload: vi.fn(),
  confirm: vi.fn(),
  save: vi.fn(),
  discard: vi.fn(),
  extract: vi.fn(),
  read: vi
    .fn()
    .mockResolvedValue({ bytes: new ArrayBuffer(1), contentType: "image/png" }),
}));
vi.mock("convex/react", () => ({
  useAction: (reference: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(reference);
    if (name.endsWith(":read")) return mocks.read;
    return name.endsWith(":upload") ? mocks.upload : mocks.extract;
  },
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(reference);
    if (name.endsWith(":confirm")) return mocks.confirm;
    return name.endsWith(":save") ? mocks.save : mocks.discard;
  },
  useQuery: () => ({ assisted: false, canOperate: true }),
  usePaginatedQuery: () => ({
    results: [],
    status: "Exhausted",
    loadMore: vi.fn(),
  }),
}));
vi.mock("@/components/shop/use-shop", () => ({
  useBusiness: () => mocks.business,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
const paper = {
  id: "paper-test" as Id<"paperDrafts">,
  name: "Private log.png",
  contentType: "image/png",
  size: 10,
  sha256: "a".repeat(64),
  createdAt: 1,
  revision: 1,
  status: "draft" as const,
  extractionStatus: "none" as const,
  extractedContent: undefined,
  reviewedContent: undefined,
  confirmedAt: undefined,
};
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
function setup(isAssisted = false, canOperate = true) {
  const ActualURL = URL;
  vi.stubGlobal(
    "URL",
    class extends ActualURL {
      static readonly createObjectURL = () => "blob:test";
      static readonly revokeObjectURL = vi.fn();
    },
  );
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PaperEditor
        paper={paper}
        assisted={isAssisted}
        canOperate={canOperate}
        onDiscard={vi.fn()}
      />
    </NextIntlClientProvider>,
  );
}
it("manual review needs confirmation, editing clears it, and saves current corrected content", async () => {
  const user = userEvent.setup();
  setup();
  const text = screen.getByRole("textbox", { name: messages.papers.text });
  const confirm = screen.getByRole("button", {
    name: messages.papers.confirmAction,
  });
  expect(confirm).toBeDisabled();
  await user.type(text, "corrected 12? kg");
  await user.click(
    screen.getByRole("checkbox", { name: messages.papers.confirm }),
  );
  expect(confirm).toBeEnabled();
  await user.type(text, " more");
  expect(confirm).toBeDisabled();
  await user.click(
    screen.getByRole("checkbox", { name: messages.papers.confirm }),
  );
  await user.click(confirm);
  await waitFor(() => {
    expect(mocks.confirm).toHaveBeenCalledWith({
      draftId: paper.id,
      expectedRevision: 1,
      content: { text: "corrected 12? kg more", rows: [] },
      confirmed: true,
    });
  });
  expect(mocks.extract).not.toHaveBeenCalled();
});
it("requires per-image external processing consent and preserves unsaved text on provider errors", async () => {
  const user = userEvent.setup();
  mocks.extract.mockResolvedValue({ status: "failed" });
  setup(true);
  const extract = screen.getByRole("button", { name: messages.papers.extract });
  expect(extract).toBeDisabled();
  await user.click(
    screen.getByRole("checkbox", { name: messages.papers.consent }),
  );
  await user.click(extract);
  await waitFor(() =>
    expect(screen.getByText(messages.papers.failed)).toBeInTheDocument(),
  );
  expect(mocks.extract).toHaveBeenCalledWith({
    draftId: paper.id,
    expectedRevision: 1,
    consent: true,
  });
  await user.type(
    screen.getByRole("textbox", { name: messages.papers.text }),
    "private correction",
  );
  expect(extract).toBeDisabled();
  expect(
    screen.getByRole("textbox", { name: messages.papers.text }),
  ).toHaveValue("private correction");
});
it("gives viewers a read-only paper and no mutation controls", () => {
  setup(false, false);
  expect(
    screen.getByRole("textbox", { name: messages.papers.text }),
  ).toBeDisabled();
  expect(
    screen.queryByRole("button", { name: messages.papers.confirmAction }),
  ).not.toBeInTheDocument();
});

it.each(["decode", "bytes"] as const)(
  "does not upload workspace A paper after switching during delayed %s",
  async (stage) => {
    const user = userEvent.setup();
    mocks.business = { id: "workspace-a" };
    const decoded = Promise.withResolvers<ImageBitmap>();
    const buffered = Promise.withResolvers<ArrayBuffer>();
    const closeBitmap = vi.fn();
    const bitmap = {
      width: 1,
      height: 1,
      close: closeBitmap,
    } as unknown as ImageBitmap;
    const decoder = vi.fn(() =>
      stage === "decode" ? decoded.promise : Promise.resolve(bitmap),
    );
    vi.stubGlobal("createImageBitmap", decoder);
    const file = new File(["synthetic paper"], "paper.png", {
      type: "image/png",
    });
    const readBytes = vi.fn(() =>
      stage === "bytes"
        ? buffered.promise
        : Promise.resolve(new ArrayBuffer(1)),
    );
    Object.defineProperty(file, "arrayBuffer", { value: readBytes });
    const view = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <PaperPage />
      </NextIntlClientProvider>,
    );
    await user.upload(screen.getByLabelText(messages.papers.upload), file);
    await waitFor(() => {
      expect(decoder).toHaveBeenCalled();
    });
    if (stage === "bytes")
      await waitFor(() => {
        expect(readBytes).toHaveBeenCalled();
      });
    mocks.business = { id: "workspace-b" };
    view.rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <PaperPage />
      </NextIntlClientProvider>,
    );
    await act(async () => {
      decoded.resolve(bitmap);
      buffered.resolve(new ArrayBuffer(1));
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(closeBitmap).toHaveBeenCalled();
    });
    expect(mocks.upload).not.toHaveBeenCalled();
  },
);
it("binds a live upload to the workspace that opened the file picker", async () => {
  const user = userEvent.setup();
  mocks.business = { id: "workspace-a" };
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockResolvedValue({ width: 1, height: 1, close: vi.fn() }),
  );
  mocks.upload.mockRejectedValueOnce(
    new Error("synthetic stop after dispatch"),
  );
  const bytes = new ArrayBuffer(1);
  const file = new File(["synthetic"], "paper.png", { type: "image/png" });
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => {
      await Promise.resolve();
      return bytes;
    },
  });
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PaperPage />
    </NextIntlClientProvider>,
  );
  await user.upload(screen.getByLabelText(messages.papers.upload), file);
  await waitFor(() => {
    expect(mocks.upload).toHaveBeenCalledWith({
      expectedOrgId: "workspace-a",
      name: "paper.png",
      contentType: "image/png",
      bytes,
    });
  });
});
