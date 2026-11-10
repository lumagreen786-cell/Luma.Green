import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Id } from "../../../convex/_generated/dataModel";
import messages from "../../../messages/en.json";
import { FileSlot } from "./file-slot";
import type { FileSummary } from "./use-mine";

const { prepare, removeFile, loadToken } = vi.hoisted(() => ({
  prepare: vi.fn(),
  removeFile: vi.fn(),
  loadToken: vi.fn(),
}));
vi.mock("@/lib/upload-image", () => ({ prepareUpload: prepare }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("convex/react", () => ({
  useMutation: () => removeFile,
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: { convex: { token: loadToken } },
}));
vi.mock("@/lib/env", () => ({
  clientEnv: { NEXT_PUBLIC_CONVEX_SITE_URL: "https://files.example" },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function renderSlot(files: FileSummary[] = []) {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <FileSlot
        type="id_proof"
        files={files}
        label="Photo ID"
        hint="Choose your ID"
      />
    </NextIntlClientProvider>,
  );
  return document.querySelector<HTMLInputElement>('input[type="file"]');
}

describe("document uploads", () => {
  it("keeps an attachment visible and restores remove after a failed deletion", async () => {
    removeFile.mockRejectedValueOnce(new Error("Private storage failure"));
    renderSlot([
      {
        id: "fixture-file" as Id<"applicationFiles">,
        type: "id_proof",
        name: "fixture.pdf",
        size: 123,
        contentType: "application/pdf",
      },
    ]);
    const remove = screen.getByRole("button", {
      name: `${messages.join.files.remove}: fixture.pdf`,
    });
    fireEvent.click(remove);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledExactlyOnceWith(
        messages.common.error,
      );
    });
    expect(screen.getByText("fixture.pdf")).toBeVisible();
    expect(remove).toBeEnabled();
  });
  it("uploads the prepared bytes and correct content type and name", async () => {
    const original = new File(["original"], "id.png", { type: "image/png" });
    const smaller = new File(["small"], "id.jpg", { type: "image/jpeg" });
    prepare.mockResolvedValue(smaller);
    loadToken.mockResolvedValue({ data: { token: "test-session" } });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const input = renderSlot();
    if (!input) throw new Error("File input missing");
    fireEvent.change(input, { target: { files: [original] } });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "https://files.example/application-uploads?type=id_proof",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer test-session",
            "Content-Type": "application/octet-stream",
            "X-Luma-File-Name": "id.jpg",
            "X-Luma-File-Size": "5",
          },
          body: smaller,
          cache: "no-store",
        },
      );
    });
  });
  it("shows the existing translated error before fetching a private token when preparation fails", async () => {
    prepare.mockRejectedValue(new Error("Invalid image"));
    const input = renderSlot();
    if (!input) throw new Error("File input missing");
    fireEvent.change(input, {
      target: {
        files: [new File(["invalid"], "id.png", { type: "image/png" })],
      },
    });
    await waitFor(() => {
      expect(screen.getByText(messages.join.errors.uploadFailed)).toBeVisible();
    });
    expect(loadToken).not.toHaveBeenCalled();
  });

  it("shows when private document storage is unavailable", async () => {
    const file = new File(["id"], "id.pdf", { type: "application/pdf" });
    prepare.mockResolvedValue(file);
    loadToken.mockResolvedValue({ data: { token: "test-session" } });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ ok: false, error: "uploadUnavailable" }),
      }),
    );
    const input = renderSlot();
    if (!input) throw new Error("File input missing");
    fireEvent.change(input, { target: { files: [file] } });
    expect(
      await screen.findByText(messages.join.errors.uploadUnavailable),
    ).toBeVisible();
  });
});
