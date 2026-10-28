import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import { NativeUpdateControl } from "./native-update-control";

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, "lumaAppUpdates");
});

function show() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <NativeUpdateControl />
    </NextIntlClientProvider>,
  );
}

it("does not add native update controls to normal browsers", () => {
  show();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("announces a downloaded update without opening a modal or restarting", () => {
  let state = "checking";
  const request = vi.fn();
  Reflect.set(window, "lumaAppUpdates", { getState: () => state, request });
  show();
  state = "ready";
  act(() => {
    document.dispatchEvent(new Event("luma-app-update"));
  });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(request).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: messages.native.updateReady }),
  );
  expect(screen.getByRole("dialog")).toBeVisible();
  fireEvent.click(
    screen.getByRole("button", { name: messages.native.restart }),
  );
  expect(request).toHaveBeenCalledWith("restart");
  state = "blocked";
  act(() => {
    document.dispatchEvent(new Event("luma-app-update"));
  });
  expect(screen.getByText(messages.native.updateBusy)).toBeVisible();
});
