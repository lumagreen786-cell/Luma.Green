import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { Id } from "../../../convex/_generated/dataModel";
import messages from "../../../messages/en.json";
import { PaperEditor, PaperPage } from "./paper-page";
const mocks = vi.hoisted(() => ({
  business: { id: "workspace-a" },
  other: null as Record<string, unknown> | null,
  detail: null as Record<string, unknown> | null,
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
  useQuery: (
    reference: Parameters<typeof getFunctionName>[0],
    args: { draftId?: string },
  ) => {
    if (!getFunctionName(reference).endsWith(":get"))
      return { assisted: false, canOperate: true };
    return args.draftId === mocks.other?.id ? mocks.other : mocks.detail;
  },
  usePaginatedQuery: () => ({
    results: [mocks.detail, mocks.other].filter(Boolean),
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
beforeEach(() => {
  mocks.save.mockResolvedValue({ draftId: paper.id, revision: 2 });
  mocks.confirm.mockResolvedValue({
    draftId: paper.id,
    revision: 2,
    status: "confirmed",
  });
});
afterEach(() => {
  vi.clearAllMocks();
  mocks.detail = null;
  mocks.other = null;
  vi.unstubAllGlobals();
});
function boardContent() {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <PaperPage />
    </NextIntlClientProvider>
  );
}
function setup(isAssisted = false, canOperate = true, onDiscard = vi.fn()) {
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
        onDiscard={onDiscard}
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

it("keeps dirty edits when another member saves and requires explicit conflict recovery", async () => {
  const user = userEvent.setup();
  setup();
  // Remount through the real board/detail path to exercise revision keys and memory.
  const { cleanup } = await import("@testing-library/react");
  cleanup();
  mocks.detail = { ...paper };
  const content = boardContent;
  const view = render(content());
  await user.click(screen.getByRole("button", { name: paper.name }));
  await user.type(
    screen.getByRole("textbox", { name: messages.papers.text }),
    "my unsaved correction",
  );
  mocks.detail = {
    ...paper,
    revision: 2,
    reviewedContent: { text: "other saved text", rows: [] },
  };
  view.rerender(content());
  expect(
    screen.getByRole("textbox", { name: messages.papers.text }),
  ).toHaveValue("my unsaved correction");
  expect(
    screen.getByRole("button", { name: messages.common.save }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", { name: messages.papers.confirmAction }),
  ).toBeDisabled();
  await user.click(
    screen.getByRole("button", { name: messages.papers.loadSaved }),
  );
  expect(
    screen.getByRole("textbox", { name: messages.papers.text }),
  ).toHaveValue("other saved text");
  await user.click(screen.getByRole("button", { name: messages.common.save }));
  expect(mocks.save).toHaveBeenCalledWith({
    draftId: paper.id,
    expectedRevision: 2,
    content: { text: "other saved text", rows: [] },
  });
});

it("shows clean remote updates but requires review again for the new revision", async () => {
  const user = userEvent.setup();
  setup();
  const { cleanup } = await import("@testing-library/react");
  cleanup();
  mocks.detail = {
    ...paper,
    reviewedContent: { text: "old saved text", rows: [] },
  };
  const content = boardContent;
  const view = render(content());
  await user.click(screen.getByRole("button", { name: paper.name }));
  await user.click(
    screen.getByRole("checkbox", { name: messages.papers.confirm }),
  );
  expect(
    screen.getByRole("button", { name: messages.papers.confirmAction }),
  ).toBeEnabled();
  mocks.detail = {
    ...paper,
    revision: 2,
    reviewedContent: { text: "new saved text", rows: [] },
  };
  view.rerender(content());
  expect(
    screen.getByRole("textbox", { name: messages.papers.text }),
  ).toHaveValue("new saved text");
  expect(
    screen.getByRole("checkbox", { name: messages.papers.confirm }),
  ).not.toBeChecked();
  expect(
    screen.getByRole("button", { name: messages.papers.confirmAction }),
  ).toBeDisabled();
});

it("does not close another record after a delayed discard finishes on an unmounted editor", async () => {
  const user = userEvent.setup();
  const done = vi.fn();
  const discarded = Promise.withResolvers<null>();
  mocks.discard.mockReturnValueOnce(discarded.promise);
  const view = setup(false, true, done);
  await user.click(
    screen.getByRole("button", { name: messages.papers.discard }),
  );
  view.unmount();
  await act(async () => {
    discarded.resolve(null);
    await discarded.promise;
  });
  expect(done).not.toHaveBeenCalled();
});

it.each(["after", "before", "newer"])(
  "reconciles a late save after switching records, reopen=%s",
  async (order) => {
    const isNewerEdits = order === "newer";
    const user = userEvent.setup();
    setup();
    const { cleanup } = await import("@testing-library/react");
    cleanup();
    const pending = Promise.withResolvers<{
      draftId: typeof paper.id;
      revision: number;
    }>();
    mocks.save.mockReturnValueOnce(pending.promise);
    mocks.detail = { ...paper };
    mocks.other = { ...paper, id: "paper-other", name: "Other paper.png" };
    const content = () => (
      <NextIntlClientProvider locale="en" messages={messages}>
        <PaperPage />
      </NextIntlClientProvider>
    );
    const view = render(content());
    await user.click(screen.getByRole("button", { name: paper.name }));
    await user.type(
      screen.getByRole("textbox", { name: messages.papers.text }),
      "submitted",
    );
    await user.click(
      screen.getByRole("button", { name: messages.common.save }),
    );
    await user.click(screen.getByRole("button", { name: "Other paper.png" }));
    if (order !== "after") {
      await user.click(screen.getByRole("button", { name: paper.name }));
      if (isNewerEdits)
        await user.type(
          screen.getByRole("textbox", { name: messages.papers.text }),
          " newer",
        );
    }
    mocks.detail = {
      ...paper,
      revision: 2,
      reviewedContent: { text: "submitted", rows: [] },
    };
    await act(async () => {
      pending.resolve({ draftId: paper.id, revision: 2 });
      await pending.promise;
    });
    view.rerender(content());
    if (order === "after")
      await user.click(screen.getByRole("button", { name: paper.name }));
    expect(
      screen.getByRole("textbox", { name: messages.papers.text }),
    ).toHaveValue(isNewerEdits ? "submitted newer" : "submitted");
    if (isNewerEdits)
      expect(
        screen.getByRole("button", { name: messages.papers.loadSaved }),
      ).toBeEnabled();
    else
      expect(
        screen.queryByRole("button", { name: messages.papers.loadSaved }),
      ).not.toBeInTheDocument();
  },
);
