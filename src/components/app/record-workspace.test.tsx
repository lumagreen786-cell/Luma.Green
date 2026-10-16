import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it } from "vitest";

import { renderWithIntl } from "@/components/shop/test-helpers";

import { RecordWorkspace } from "./record-workspace";

function Records() {
  const [selected, setSelected] = useState(false);
  return (
    <RecordWorkspace
      list={
        <button
          onClick={() => {
            setSelected(true);
          }}
        >
          Open route
        </button>
      }
      detail={selected ? <h2>Route history</h2> : undefined}
      onBack={() => {
        setSelected(false);
      }}
    />
  );
}
it("moves keyboard focus to an opened record and restores it when closed", async () => {
  const user = userEvent.setup();
  renderWithIntl(<Records />);
  await user.click(screen.getByRole("button", { name: "Open route" }));
  expect(
    screen.getByRole("heading", { name: "Route history" }).parentElement,
  ).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Close" }));
  expect(
    screen.queryByRole("heading", { name: "Route history" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Open route" })).toHaveFocus();
});

function MultipleRecords() {
  const [selected, setSelected] = useState<string>();
  return (
    <RecordWorkspace
      list={
        <>
          {["A", "B"].map((id) => (
            <button
              key={id}
              onClick={() => {
                setSelected(id);
              }}
            >
              Open {id}
            </button>
          ))}
        </>
      }
      detailKey={selected}
      detail={selected ? <h2>Route {selected}</h2> : undefined}
      onBack={() => {
        setSelected(undefined);
      }}
    />
  );
}

it("focuses the newly selected record and returns to its own opener", async () => {
  const user = userEvent.setup();
  renderWithIntl(<MultipleRecords />);
  await user.click(screen.getByRole("button", { name: "Open A" }));
  await user.click(screen.getByRole("button", { name: "Open B" }));
  expect(
    screen.getByRole("heading", { name: "Route B" }).parentElement,
  ).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.getByRole("button", { name: "Open B" })).toHaveFocus();
});
