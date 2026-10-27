import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Id } from "../../../convex/_generated/dataModel";
import messages from "../../../messages/en.json";
import type { Board, Job } from "./job-meta";
import { SaathiHome } from "./saathi-home";

const board = vi.hoisted((): { current: unknown } => ({ current: undefined }));
const take = vi.hoisted(() => vi.fn());
const finish = vi.hoisted(() => vi.fn());
vi.mock("@/components/collection/worker-handovers", () => ({
  WorkerHandovers: () => null,
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useQuery: () => board.current,
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(reference) === "saathi:take" ? take : finish,
}));

vi.mock("@/components/app/use-workspace", () => ({
  useWorkspace: () => ({
    kind: "saathi",
    saathi: { name: "Lakshmi Devi", area: "Yeshwanthpur", city: "Bengaluru" },
  }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const TODAY = "2026-09-29";

function job(overrides: Partial<Job> & Pick<Job, "id" | "title">): Job {
  return {
    kind: "home_pickups",
    area: "Yeshwanthpur",
    date: TODAY,
    window: "evening",
    payPaise: 45_000,
    status: "open",
    postedBy: { name: "Ramesh Kabadi Store", kind: "kabadiwala" },
    inMyArea: true,
    ...overrides,
  };
}

const jobId = (id: string) => id as Id<"jobs">;

const fixture: Board = {
  today: TODAY,
  open: [
    job({ id: jobId("open-1"), title: "Home pickups, 6 houses" }),
    job({
      id: jobId("open-2"),
      title: "Sorting shift: paper and PET",
      kind: "yard_sorting",
      area: "Peenya",
      date: "2026-09-30",
      window: "morning",
      payPaise: 70_000,
      inMyArea: false,
      postedBy: { name: "Peenya Paper & Plastic Yard", kind: "yard" },
    }),
  ],
  mine: [
    job({
      id: jobId("mine-1"),
      title: "Home pickups, 4 houses",
      area: "Mathikere",
      window: "morning",
      payPaise: 35_000,
      status: "assigned",
      inMyArea: false,
    }),
    job({
      id: jobId("mine-2"),
      title: "Line helper, flake packing",
      kind: "factory_shifts",
      date: "2026-10-01",
      status: "assigned",
    }),
  ],
  done: [],
  earnings: {
    totalPaise: 110_000,
    jobsDone: 2,
    weekPaise: 110_000,
    weekJobs: 2,
  },
};

function renderHome() {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={messages}
      timeZone="Asia/Kolkata"
    >
      <SaathiHome />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  board.current = fixture;
  take.mockReset();
  finish.mockReset();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});

describe("SaathiHome", () => {
  it("greets the Saathi and leads with this week's pay", () => {
    renderHome();
    expect(
      screen.getByRole("heading", { level: 1, name: "Hello, Lakshmi Devi" }),
    ).toBeInTheDocument();
    const week = screen.getByRole("region", { name: "Earned this week" });
    expect(week).toHaveTextContent("₹1,100");
    expect(week).toHaveTextContent("Last 7 days · 2 jobs");
    expect(
      within(week).getByRole("link", { name: /See all earnings/ }),
    ).toHaveAttribute("href", "/app/impact");
  });

  it("shows today's jobs to mark done, later ones apart, and open jobs to take", () => {
    renderHome();
    const today = screen.getByRole("article", {
      name: "Pickups from homes Home pickups, 4 houses",
    });
    expect(today).toHaveTextContent("Today, Morning");
    expect(
      within(today).getByRole("button", { name: /Mark done/ }),
    ).toHaveTextContent(/^Mark done$/u);

    const later = screen.getByRole("article", { name: /^Factory shift/ });
    expect(within(later).queryByRole("button")).not.toBeInTheDocument();
    expect(later).toHaveTextContent("You can mark it done on the day.");

    const takeButtons = screen.getAllByRole("button", {
      name: /Take this job/,
    });
    expect(takeButtons).toHaveLength(2);
    for (const button of takeButtons)
      expect(button).toHaveTextContent(/^Accept$/u);
    const nearby = screen.getByRole("article", {
      name: /Home pickups, 6 houses/,
    });
    expect(within(nearby).getByText("Your area")).toBeInTheDocument();
    const peenya = screen.getByRole("article", { name: /paper and PET/ });
    expect(peenya).toHaveTextContent("Tomorrow, Morning");
    expect(within(peenya).queryByText("Your area")).not.toBeInTheDocument();
  });

  it("takes a job with one tap", async () => {
    take.mockResolvedValue(null);
    renderHome();
    const [first] = screen.getAllByRole("button", { name: /Take this job/ });
    await userEvent.click(first);
    expect(take).toHaveBeenCalledWith({ jobId: "open-1" });
    expect(toast.success).toHaveBeenCalledWith(
      "Job taken. It's on your list now.",
    );
  });

  it("says why a job couldn't be taken, next to the button", async () => {
    take.mockRejectedValue(new ConvexError("JOB_TAKEN"));
    renderHome();
    const [first] = screen.getAllByRole("button", { name: /Take this job/ });
    await userEvent.click(first);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Someone else took this job. Try another one.",
    );
    expect(toast.error).toHaveBeenCalledWith(
      "Someone else took this job. Try another one.",
    );
  });

  it("asks once more before marking a job done", async () => {
    finish.mockResolvedValue(null);
    renderHome();
    await userEvent.click(screen.getByRole("button", { name: /Mark done/ }));

    const dialog = await screen.findByRole("dialog", {
      name: "Finished this job?",
    });
    expect(dialog).toHaveTextContent(
      "Home pickups, 4 houses in Mathikere. ₹350 will be added to your earnings.",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: /Yes, it's done/ }),
    );
    expect(finish).toHaveBeenCalledWith({ jobId: "mine-1" });
    expect(toast.success).toHaveBeenCalledWith(
      "Well done! ₹350 added to your earnings.",
    );
  });

  it("shows friendly empty states", () => {
    board.current = { ...fixture, open: [], mine: [] };
    renderHome();
    expect(screen.getByText("No jobs for today")).toBeInTheDocument();
    expect(screen.getByText("No open jobs right now")).toBeInTheDocument();
  });

  it("holds the layout while loading", () => {
    board.current = undefined;
    const { container } = renderHome();
    expect(container.querySelector("[aria-busy='true']")).toBeInTheDocument();
  });
});
