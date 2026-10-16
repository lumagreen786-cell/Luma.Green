import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ar from "../../../messages/ar.json";
import en from "../../../messages/en.json";
import { NotificationsPage } from "./notifications-page";

const state = vi.hoisted(() => ({
  auth: { isAuthenticated: true, isLoading: false },
  subscribe: vi.fn(),
  results: [
    {
      id: "inbox-a",
      event: "booking_confirmed",
      read: false,
      createdAt: 1_790_896_800_000,
    },
  ],
  status: "Exhausted",
  count: 1,
  queryError: false,
  loadMore: vi.fn(),
  markRead: vi.fn(),
  markAllRead: vi.fn(),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: state.auth.isAuthenticated ? { user: { id: "inbox-user" } } : null,
      isPending: false,
      error: null,
    }),
  },
}));
vi.mock("@/components/providers/convex-provider", () => ({
  isConvexConfigured: true,
}));
vi.mock("./device-provider", () => ({ useNotificationDevice: () => null }));
vi.mock("convex/react", () => ({
  useConvexAuth: () => state.auth,
  usePaginatedQuery: () => {
    state.subscribe();
    if (state.queryError) throw new Error("inbox:list is unavailable");
    return {
      results: state.results,
      status: state.status,
      loadMore: state.loadMore,
    };
  },
  useQuery: () => state.count,
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(reference) === "inbox:markRead"
      ? state.markRead
      : state.markAllRead,
}));

beforeEach(() => {
  state.auth = { isAuthenticated: true, isLoading: false };
  state.subscribe.mockReset();
  state.results = [
    {
      id: "inbox-a",
      event: "booking_confirmed",
      read: false,
      createdAt: 1_790_896_800_000,
    },
  ];
  state.status = "Exhausted";
  state.count = 1;
  state.queryError = false;
  state.markRead.mockReset().mockResolvedValue(null);
  state.markAllRead.mockReset().mockResolvedValue(null);
});
afterEach(() => {
  vi.restoreAllMocks();
});

function page(locale: "en" | "ar" = "en") {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "en" ? en : ar}
    >
      <NotificationsPage />
    </NextIntlClientProvider>
  );
}

describe("account notification inbox", () => {
  it("keeps settings usable when the optional inbox backend is unavailable", () => {
    vi.spyOn(console, "error").mockImplementation(() => {
      // React reports the deliberately caught query failure to the console.
    });
    state.queryError = true;
    render(page());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      en.notifications.title,
    );
    expect(
      screen.getByRole("heading", { name: en.notifications.deviceTitle }),
    ).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(
      en.notifications.unavailable,
    );
    expect(
      screen.getByRole("button", { name: en.notifications.enable }),
    ).toBeDisabled();
  });
  it("shows the account update and marks the selected entry read", async () => {
    const user = userEvent.setup();
    render(page());
    expect(
      screen.getByText(en.notifications.events.booking_confirmed),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: en.notifications.enable }),
    ).toBeDisabled();
    await user.click(
      screen.getByRole("button", { name: en.notifications.markRead }),
    );
    expect(state.markRead).toHaveBeenCalledWith({ id: "inbox-a" });
  });
  it("keeps the update visible when marking it read fails", async () => {
    const user = userEvent.setup();
    state.markRead.mockRejectedValue(new Error("offline"));
    render(page());
    await user.click(
      screen.getByRole("button", { name: en.notifications.markRead }),
    );
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(en.common.error);
    });
    expect(
      screen.getByText(en.notifications.events.booking_confirmed),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: en.notifications.markRead }),
    ).toBeEnabled();
  });
  it("shows a useful empty state without synthetic events", () => {
    state.results = [];
    state.count = 0;
    render(page());
    expect(screen.getByText(en.notifications.emptyTitle)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: en.notifications.markAllRead }),
    ).not.toBeInTheDocument();
  });
  it("uses Arabic event and action copy", () => {
    render(page("ar"));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      ar.notifications.title,
    );
    expect(
      screen.getByText(ar.notifications.events.booking_confirmed),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: ar.notifications.markRead }),
    ).toBeVisible();
  });
});

it("waits for verified client auth before subscribing and removes private data on sign-out", () => {
  state.auth = { isAuthenticated: false, isLoading: true };
  const view = render(page());
  expect(screen.getByLabelText(en.common.loading)).toHaveAttribute(
    "aria-busy",
    "true",
  );
  expect(state.subscribe).not.toHaveBeenCalled();
  expect(
    screen.queryByText(en.notifications.events.booking_confirmed),
  ).not.toBeInTheDocument();

  state.auth = { isAuthenticated: false, isLoading: false };
  view.rerender(page());
  expect(state.subscribe).not.toHaveBeenCalled();
  expect(
    screen.queryByRole("heading", { name: en.notifications.inboxTitle }),
  ).not.toBeInTheDocument();

  state.auth = { isAuthenticated: true, isLoading: false };
  view.rerender(page());
  expect(state.subscribe).toHaveBeenCalledOnce();
  expect(
    screen.getByText(en.notifications.events.booking_confirmed),
  ).toBeVisible();

  state.auth = { isAuthenticated: false, isLoading: false };
  view.rerender(page());
  expect(state.subscribe).toHaveBeenCalledOnce();
  expect(
    screen.queryByText(en.notifications.events.booking_confirmed),
  ).not.toBeInTheDocument();
});

it("hides the previous identity's pages and unread controls while the next identity is confirmed", () => {
  const view = render(page());
  expect(
    screen.getByText(en.notifications.events.booking_confirmed),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: en.notifications.markAllRead }),
  ).toBeVisible();

  // The installed auth provider clears confirmation when the session identity changes.
  // Keep the old hook result available here to prove the render gate does not expose it.
  state.auth = { isAuthenticated: false, isLoading: true };
  view.rerender(page());
  expect(
    screen.queryByText(en.notifications.events.booking_confirmed),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: en.notifications.markAllRead }),
  ).not.toBeInTheDocument();
  expect(state.subscribe).toHaveBeenCalledOnce();

  state.results = [
    {
      id: "inbox-b",
      event: "application_approved",
      read: true,
      createdAt: 1_790_896_800_000,
    },
  ];
  state.count = 0;
  state.auth = { isAuthenticated: true, isLoading: false };
  view.rerender(page());
  expect(state.subscribe).toHaveBeenCalledTimes(2);
  expect(
    screen.getByText(en.notifications.events.application_approved),
  ).toBeVisible();
  expect(
    screen.queryByText(en.notifications.events.booking_confirmed),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: en.notifications.markAllRead }),
  ).not.toBeInTheDocument();
});

it.each(["en", "ar"] as const)(
  "renders a generic task notice in %s",
  (locale) => {
    state.results = [
      {
        id: "task-notice",
        event: "collaboration_updated",
        read: false,
        createdAt: 1_790_896_800_000,
      },
    ];
    render(page(locale));
    const messages = locale === "en" ? en : ar;
    expect(
      screen.getByText(messages.notifications.lockscreenTitle),
    ).toBeVisible();
  },
);

it("places inbox messages before device settings while keeping permission status available", () => {
  render(page());
  const inbox = document.querySelector("#notification-inbox");
  const device = document.querySelector("#notification-device");
  expect(inbox).not.toBeNull();
  expect(device).not.toBeNull();
  expect(inbox?.compareDocumentPosition(device as Node)).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  );
  expect(
    screen.getByRole("region", { name: en.notifications.deviceTitle }),
  ).toBeVisible();
});
