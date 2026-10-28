import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";
import { expect, it } from "vitest";

import arabic from "../../../messages/ar.json";
import english from "../../../messages/en.json";
import { CityField } from "./city-field";

function Example() {
  const [city, setCity] = useState("");
  return (
    <>
      <CityField value={city} onChange={setCity} />
      <output aria-label="Saved locality">{city}</output>
    </>
  );
}
it.each([
  ["en", english],
  ["ar", arabic],
] as const)(
  "keeps explicit city/state choices and changes the serialized partition in %s",
  async (locale, copy) => {
    render(
      <NextIntlClientProvider locale={locale} messages={copy}>
        <Example />
      </NextIntlClientProvider>,
    );
    const user = userEvent.setup();
    fireEvent.change(
      screen.getByRole("textbox", { name: copy.join.form.city }),
      { target: { value: "Bilaspur" } },
    );
    await user.click(
      screen.getByRole("combobox", { name: copy.join.form.stateUT }),
    );
    await user.click(screen.getByRole("option", { name: "Chhattisgarh" }));
    expect(screen.getByLabelText("Saved locality")).toHaveTextContent(
      "Bilaspur, Chhattisgarh",
    );
    expect(
      screen.getByRole("textbox", { name: copy.join.form.city }),
    ).toHaveValue("Bilaspur");
    await user.click(
      screen.getByRole("combobox", { name: copy.join.form.stateUT }),
    );
    await user.click(screen.getByRole("option", { name: "Himachal Pradesh" }));
    expect(screen.getByLabelText("Saved locality")).toHaveTextContent(
      "Bilaspur, Himachal Pradesh",
    );
    expect(
      screen.getByRole("textbox", { name: copy.join.form.city }),
    ).toHaveValue("Bilaspur");
  },
);
