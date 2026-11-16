import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

function Example({
  orientation = "horizontal",
  dir = "ltr",
}: {
  orientation?: "horizontal" | "vertical";
  dir?: "ltr" | "rtl";
}) {
  return (
    <Tabs defaultValue="first" orientation={orientation} dir={dir}>
      <TabsList aria-label="Records">
        <TabsTrigger value="first">First</TabsTrigger>
        <TabsTrigger value="unavailable" disabled>
          Unavailable
        </TabsTrigger>
        <TabsTrigger value="last">Last</TabsTrigger>
      </TabsList>
      <TabsContent value="first">First records</TabsContent>
      <TabsContent value="last">Last records</TabsContent>
    </Tabs>
  );
}

it.each([
  ["ltr", "ArrowRight"],
  ["rtl", "ArrowLeft"],
] as const)(
  "uses %s arrow navigation and skips disabled tabs",
  async (dir, key) => {
    const user = userEvent.setup();
    render(<Example dir={dir} />);
    screen.getByRole("tab", { name: "First" }).focus();
    await user.keyboard(`{${key}}`);
    expect(screen.getByRole("tab", { name: "Last" })).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Last records");
    expect(screen.queryByText("First records")).not.toBeInTheDocument();
  },
);

it("uses vertical keyboard navigation when the tabs are vertical", async () => {
  const user = userEvent.setup();
  render(<Example orientation="vertical" />);
  expect(screen.getByRole("tablist")).toHaveAttribute(
    "aria-orientation",
    "vertical",
  );
  screen.getByRole("tab", { name: "First" }).focus();
  await user.keyboard("{ArrowDown}");
  expect(screen.getByRole("tab", { name: "Last" })).toHaveFocus();
  expect(screen.getByRole("tabpanel")).toHaveTextContent("Last records");
  await user.keyboard("{Home}");
  expect(screen.getByRole("tab", { name: "First" })).toHaveFocus();
  expect(screen.getByRole("tabpanel")).toHaveTextContent("First records");
});

it("keeps bounded corners for long wrapping labels and circular record counts", () => {
  render(
    <Tabs defaultValue="long" dir="rtl">
      <TabsList aria-label="سجلات">
        <TabsTrigger value="long" count={12}>
          سجل المواد والمجموعات الطويلة
        </TabsTrigger>
      </TabsList>
      <TabsContent value="long">Records</TabsContent>
    </Tabs>,
  );
  const tab = screen.getByRole("tab");
  expect(tab).toHaveClass("rounded-2xl", "whitespace-normal");
  expect(tab).not.toHaveClass("rounded-full");
  expect(screen.getByText("12")).toHaveClass("rounded-full");
});
