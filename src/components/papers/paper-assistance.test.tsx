import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";

import type { Id } from "../../../convex/_generated/dataModel";
import messages from "../../../messages/en.json";
import { AssistEditor } from "./paper-assistance";
const mocks = vi.hoisted(() => ({
  save: vi.fn().mockResolvedValue({ assistId: "assist-test", revision: 1 }),
  confirm: vi.fn().mockResolvedValue({
    assistId: "assist-test",
    revision: 1,
    status: "confirmed",
  }),
  discard: vi.fn(),
  generate: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useMutation: (ref: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(ref);
    if (name.endsWith(":save")) return mocks.save;
    return name.endsWith(":confirm") ? mocks.confirm : mocks.discard;
  },
  useAction: () => mocks.generate,
  useQuery: vi.fn(),
}));
const item = {
  id: "assist-test" as Id<"paperAssists">,
  revision: 0,
  mode: "translation" as const,
  targetLocale: "kn",
  sourceText: "Source 12? kg",
  reviewedText: "",
  modelText: undefined,
  status: "draft" as const,
  attemptStatus: "none" as const,
};
afterEach(() => {
  vi.clearAllMocks();
});
function setup(
  isAvailable = false,
  canOperate = true,
  value: Parameters<typeof AssistEditor>[0]["item"] = item,
) {
  const remember = vi.fn();
  const onDiscard = vi.fn();
  return {
    remember,
    onDiscard,
    ...render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <AssistEditor
          item={value}
          available={isAvailable}
          canOperate={canOperate}
          remember={remember}
          onDiscard={onDiscard}
        />
      </NextIntlClientProvider>,
    ),
  };
}
it("manual confirmation requires reviewed nonempty text, editing clears confirmation and calls no model", async () => {
  const user = userEvent.setup();
  const { remember } = setup();
  const copy = messages.paperAssist;
  const input = screen.getByRole("textbox", { name: copy.reviewedText });
  const confirm = screen.getByRole("button", { name: copy.confirm });
  expect(confirm).toBeDisabled();
  await user.type(input, "Reviewed 12? kg");
  await user.click(screen.getByRole("checkbox", { name: copy.review }));
  expect(confirm).toBeEnabled();
  await user.type(input, " more");
  expect(confirm).toBeDisabled();
  await user.click(screen.getByRole("checkbox", { name: copy.review }));
  await user.click(confirm);
  await waitFor(() => {
    expect(mocks.confirm).toHaveBeenCalledWith({
      assistId: item.id,
      expectedRevision: 0,
      text: "Reviewed 12? kg more",
      confirmed: true,
    });
  });
  expect(remember).toHaveBeenCalledWith({
    revision: 0,
    text: "Reviewed 12? kg more",
  });
  expect(mocks.generate).not.toHaveBeenCalled();
});
it("requires fresh external consent and preserves unsaved manual text when model fails", async () => {
  const user = userEvent.setup();
  mocks.generate.mockResolvedValue({ status: "failed" });
  setup(true);
  const copy = messages.paperAssist;
  const generate = screen.getByRole("button", { name: copy.generate });
  expect(generate).toBeDisabled();
  const text = screen.getByRole("textbox", { name: copy.reviewedText });
  await user.type(text, "keep private draft");
  await user.click(screen.getByRole("checkbox", { name: copy.consent }));
  await user.click(generate);
  await waitFor(() => {
    expect(screen.getByText(copy.failed)).toBeInTheDocument();
  });
  expect(text).toHaveValue("keep private draft");
  expect(mocks.generate).toHaveBeenCalledWith({
    assistId: item.id,
    expectedRevision: 0,
    consent: true,
  });
});
it("requires explicit model-copy action and never renders source/model strings as HTML", async () => {
  const user = userEvent.setup();
  const value = {
    ...item,
    modelText: "<img src=x onerror=attack()> uncertain12?",
  };
  setup(false, true, value);
  const copy = messages.paperAssist;
  expect(screen.getByRole("textbox")).toHaveValue("");
  expect(document.querySelector("img")).toBeNull();
  await user.click(screen.getByRole("button", { name: copy.useModel }));
  expect(screen.getByRole("textbox")).toHaveValue(value.modelText);
});
it("viewer controls cannot change private derivatives", () => {
  setup(false, false);
  expect(screen.getByRole("textbox")).toBeDisabled();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
it("does not apply a model result arriving after unmount", async () => {
  const user = userEvent.setup();
  const pending = Promise.withResolvers<{ status: string }>();
  mocks.generate.mockImplementation(() => pending.promise);
  const view = setup(true);
  const copy = messages.paperAssist;
  await user.click(screen.getByRole("checkbox", { name: copy.consent }));
  await user.click(screen.getByRole("button", { name: copy.generate }));
  view.unmount();
  pending.resolve({ status: "ok" });
  expect(view.remember).not.toHaveBeenCalled();
});

it("confirmed evidence displays the server text instead of stale local edits", () => {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AssistEditor
        item={{
          ...item,
          status: "confirmed",
          reviewedText: "Final reviewed text",
        }}
        available={false}
        canOperate
        initialDraft={{ revision: 0, text: "Stale unsaved text" }}
        remember={vi.fn()}
        onDiscard={vi.fn()}
      />
    </NextIntlClientProvider>,
  );
  expect(screen.getByRole("textbox")).toHaveValue("Final reviewed text");
});
it("does not adopt a new server revision for an old checked local draft", async () => {
  const user = userEvent.setup();
  const remember = vi.fn();
  const renderEditor = (revision: number, reviewedText: string) => (
    <NextIntlClientProvider locale="en" messages={messages}>
      <AssistEditor
        item={{ ...item, revision, reviewedText }}
        available
        canOperate
        remember={remember}
        onDiscard={vi.fn()}
      />
    </NextIntlClientProvider>
  );
  const view = render(renderEditor(0, "Initial server text"));
  await user.clear(screen.getByRole("textbox"));
  await user.type(screen.getByRole("textbox"), "Actor A local text");
  await user.click(
    screen.getByRole("checkbox", { name: messages.paperAssist.review }),
  );
  view.rerender(renderEditor(1, "Actor B saved text"));
  expect(screen.getByRole("textbox")).toHaveValue("Actor A local text");
  await user.click(
    screen.getByRole("button", { name: messages.paperAssist.confirm }),
  );
  expect(mocks.confirm).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole("button", { name: messages.paperAssist.reload }),
  );
  expect(screen.getByRole("textbox")).toHaveValue("Actor B saved text");
  expect(screen.getByText("Actor A local text")).toBeInTheDocument();
  expect(
    screen.getByRole("checkbox", { name: messages.paperAssist.review }),
  ).not.toBeChecked();
  expect(
    screen.getByRole("checkbox", { name: messages.paperAssist.consent }),
  ).not.toBeChecked();
  expect(
    screen.getByRole("button", { name: messages.paperAssist.confirm }),
  ).toBeDisabled();
  await user.click(
    screen.getByRole("checkbox", { name: messages.paperAssist.review }),
  );
  await user.click(
    screen.getByRole("button", { name: messages.paperAssist.confirm }),
  );
  expect(mocks.confirm).toHaveBeenCalledWith({
    assistId: item.id,
    expectedRevision: 1,
    text: "Actor B saved text",
    confirmed: true,
  });
});

it("retains the base revision of cached edits across a remount", () => {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AssistEditor
        item={{ ...item, revision: 3, reviewedText: "New saved text" }}
        initialDraft={{ revision: 0, text: "Cached old draft" }}
        available
        canOperate
        remember={vi.fn()}
        onDiscard={vi.fn()}
      />
    </NextIntlClientProvider>,
  );
  expect(screen.getByRole("textbox")).toHaveValue("Cached old draft");
  expect(
    screen.getByRole("button", { name: messages.common.save }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", { name: messages.paperAssist.generate }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", { name: messages.paperAssist.discard }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", { name: messages.paperAssist.reload }),
  ).toBeEnabled();
});
