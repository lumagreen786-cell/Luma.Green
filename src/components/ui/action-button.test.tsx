import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ActionButton } from "./action-button";

describe("ActionButton", () => {
  it("uses the shared primitive and defaults to a non-submit action", () => {
    const onClick = vi.fn();
    render(<ActionButton label="Save" onClick={onClick} />);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("data-slot", "button");
    expect(button).toHaveAttribute("data-variant", "default");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("preserves submit intent, labels, children and secondary actions", () => {
    render(
      <ActionButton
        type="submit"
        name="intent"
        value="enquiry"
        label="Send enquiry"
        variant="secondary"
      >
        Send
      </ActionButton>,
    );
    const button = screen.getByRole("button", { name: "Send enquiry" });
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toHaveAttribute("name", "intent");
    expect(button).toHaveValue("enquiry");
    expect(button).toHaveAttribute("data-variant", "secondary");
    expect(button).toHaveTextContent("Send");
  });

  it("keeps an icon-only update action named and focusable with its tooltip", () => {
    render(
      <ActionButton
        label="Check for updates"
        icon={<svg aria-hidden />}
        isIconOnly
        tooltip="Check for updates"
      />,
    );
    const button = screen.getByRole("button", { name: "Check for updates" });
    expect(button).not.toHaveTextContent("Check for updates");
    expect(button.querySelector("svg")).not.toBeNull();
    button.focus();
    expect(button).toHaveFocus();
  });

  it("does not dispatch disabled or externally loading actions", () => {
    const action = vi.fn();
    const view = render(
      <ActionButton label="Save" isDisabled onClick={action} />,
    );
    fireEvent.click(screen.getByRole("button"));
    view.rerender(<ActionButton label="Save" isLoading onClick={action} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
    fireEvent.click(screen.getByRole("button"));
    expect(action).not.toHaveBeenCalled();
  });

  it("blocks disabled tooltip actions while retaining keyboard focus", () => {
    const action = vi.fn();
    render(
      <ActionButton label="Save" tooltip="Save" isDisabled onClick={action} />,
    );
    const button = screen.getByRole("button", { name: "Save" });
    button.focus();
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(button);
    expect(action).not.toHaveBeenCalled();
  });

  it("deduplicates same-turn async clicks and restores the action after completion", async () => {
    const deferred = Promise.withResolvers<undefined>();
    const action = vi.fn(() => deferred.promise);
    render(<ActionButton label="Save" clickAction={action} />);
    const button = screen.getByRole("button", { name: "Save" });
    act(() => {
      button.click();
      button.click();
    });
    expect(action).toHaveBeenCalledOnce();
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    await act(async () => {
      deferred.resolve(undefined);
      await deferred.promise;
    });
    await waitFor(() => expect(button).toBeEnabled());
    expect(button).not.toHaveAttribute("aria-busy");
  });

  it("honours click cancellation before starting an async action", () => {
    const action = vi.fn();
    render(
      <ActionButton
        label="Save"
        onClick={(event) => {
          event.preventDefault();
        }}
        clickAction={action}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(action).not.toHaveBeenCalled();
  });

  it("permits an explicit interruptible action while pending", async () => {
    const deferred = Promise.withResolvers<undefined>();
    const action = vi.fn(() => deferred.promise);
    render(
      <ActionButton label="Refresh" clickAction={action} isInterruptible />,
    );
    const button = screen.getByRole("button", { name: "Refresh" });
    act(() => {
      button.click();
      button.click();
    });
    expect(action).toHaveBeenCalledTimes(2);
    expect(button).toBeEnabled();
    await act(async () => {
      deferred.resolve(undefined);
      await deferred.promise;
    });
  });
});
