import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { useForm } from "react-hook-form";
import { expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import { FormJourney } from "./form-journey";

function Fixture({
  finish,
}: {
  finish: (values: { name: string; address: string }) => void;
}) {
  const { register, trigger, getFieldState, handleSubmit, setValue } = useForm({
    defaultValues: { name: "", address: "" },
  });
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <FormJourney
        header={<h1>Application</h1>}
        trigger={trigger}
        getFieldState={getFieldState}
        onFinish={(event) => {
          return handleSubmit(finish)(event);
        }}
        stages={[
          {
            title: "Identity",
            fields: ["name"],
            content: (
              <label>
                Name
                <input {...register("name", { required: true })} />
              </label>
            ),
          },
          {
            title: "Location",
            fields: ["address"],
            content: (
              <>
                <label>
                  Address
                  <input {...register("address", { required: true })} />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setValue("name", "");
                  }}
                >
                  Invalidate earlier name
                </button>
              </>
            ),
          },
        ]}
        submit={<button type="submit">Send application</button>}
      />
    </NextIntlClientProvider>
  );
}

it("blocks incomplete stages, preserves values on Back, and submits only the complete form", async () => {
  const finish = vi.fn();
  render(<Fixture finish={finish} />);
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByRole("heading", { name: "Identity" })).toBeVisible();
  expect(finish).not.toHaveBeenCalled();
  await userEvent.type(
    screen.getByRole("textbox", { name: "Name" }),
    "Demo owner{Enter}",
  );
  expect(
    await screen.findByRole("heading", { name: "Location" }),
  ).toHaveFocus();
  await userEvent.type(
    screen.getByRole("textbox", { name: "Address" }),
    "Demo street",
  );
  await userEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue(
    "Demo owner",
  );
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByRole("textbox", { name: "Address" })).toHaveValue(
    "Demo street",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Send application" }),
  );
  expect(finish).toHaveBeenCalledWith(
    { name: "Demo owner", address: "Demo street" },
    expect.anything(),
  );
});

it("returns to an invalid earlier stage before allowing final submission", async () => {
  const finish = vi.fn();
  render(<Fixture finish={finish} />);
  await userEvent.type(
    screen.getByRole("textbox", { name: "Name" }),
    "Demo owner{Enter}",
  );
  await userEvent.type(
    await screen.findByRole("textbox", { name: "Address" }),
    "Demo street",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Invalidate earlier name" }),
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Send application" }),
  );
  expect(
    await screen.findByRole("heading", { name: "Identity" }),
  ).toBeVisible();
  expect(finish).not.toHaveBeenCalled();
});
