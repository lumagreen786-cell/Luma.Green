import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { type ReactNode, StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import en from "../../../messages/en.json";
import { RecyclingPhotos } from "./recycling-photos";

const createUrl = vi.fn();
const revokeUrl = vi.fn();
function translated(children: ReactNode) {
  return (
    <NextIntlClientProvider locale="en" messages={en}>
      {children}
    </NextIntlClientProvider>
  );
}
beforeEach(() => {
  let nextUrl = 0;
  createUrl
    .mockReset()
    .mockImplementation(() => `blob:photo-${String(++nextUrl)}`);
  revokeUrl.mockReset();
  vi.stubGlobal(
    "URL",
    class extends URL {
      static readonly createObjectURL = createUrl;
      static readonly revokeObjectURL = revokeUrl;
    },
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

it("replaces the preview when same-named photos exchange a list position", () => {
  const first = new File(["first"], "photo.jpg", {
    type: "image/jpeg",
    lastModified: 1,
  });
  const second = new File(["second"], "photo.jpg", {
    type: "image/jpeg",
    lastModified: 1,
  });
  const view = render(
    translated(<RecyclingPhotos files={[first, second]} onChange={vi.fn()} />),
  );
  const firstUrl = screen.getAllByRole("img")[0]?.getAttribute("src");
  view.rerender(
    translated(<RecyclingPhotos files={[second]} onChange={vi.fn()} />),
  );

  expect(screen.getByRole("img")).not.toHaveAttribute("src", firstUrl);
  expect(createUrl).toHaveBeenLastCalledWith(second);
  expect(revokeUrl).toHaveBeenCalledWith(firstUrl);
});

it("keeps the mounted preview URL live through strict effect replay", () => {
  const file = new File(["photo"], "photo.jpg", { type: "image/jpeg" });
  const view = render(
    <StrictMode>
      {translated(<RecyclingPhotos files={[file]} onChange={vi.fn()} />)}
    </StrictMode>,
  );
  const current = screen.getByRole("img").getAttribute("src");
  expect(revokeUrl).not.toHaveBeenCalledWith(current);
  view.unmount();
  expect(revokeUrl).toHaveBeenCalledWith(current);
});
