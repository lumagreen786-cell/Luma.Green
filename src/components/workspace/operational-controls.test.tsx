import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { expect, it, vi } from "vitest";

import { RateRow } from "@/components/shop/rate-row";
import {
  AcceptDecline,
  StartTripButton,
} from "@/components/shop/request-actions";
import { NEWSPAPER } from "@/components/shop/test-helpers";

import type { Id } from "../../../convex/_generated/dataModel";
import en from "../../../messages/en.json";
import { WorkspacePermissions } from "./permissions";

vi.mock("convex/react", () => ({ useMutation: () => vi.fn() }));

it("revokes rate editing before collection rights as an admin becomes a member then viewer", () => {
  const content = (
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Kolkata">
      <AcceptDecline bookingId={"test-booking" as Id<"bookings">} />
      <StartTripButton bookingId={"test-booking" as Id<"bookings">} />
      <ul>
        <RateRow
          row={{
            material: NEWSPAPER,
            myPaise: 1450,
            floorPaise: 1200,
            fallbackPaise: 1400,
            marketPaise: 1500,
            marketDate: "2026-09-29",
          }}
        />
      </ul>
    </NextIntlClientProvider>
  );
  const view = render(
    <WorkspacePermissions membershipRole="admin">
      {content}
    </WorkspacePermissions>,
  );
  expect(
    screen.getByRole("button", { name: en.shop.requests.accept }),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: en.shop.requests.startTrip }),
  ).toBeVisible();
  expect(screen.getByRole("textbox")).toBeEnabled();
  view.rerender(
    <WorkspacePermissions membershipRole="member">
      {content}
    </WorkspacePermissions>,
  );
  expect(screen.getByRole("textbox")).toBeDisabled();
  expect(
    screen.getByRole("button", { name: en.shop.requests.accept }),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: en.shop.requests.startTrip }),
  ).toBeVisible();
  view.rerender(
    <WorkspacePermissions membershipRole="viewer">
      {content}
    </WorkspacePermissions>,
  );
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.getByRole("textbox")).toBeDisabled();
});
