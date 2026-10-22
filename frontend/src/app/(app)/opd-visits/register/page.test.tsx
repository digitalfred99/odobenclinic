import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import OPDVisitRegistrationPage from "./page";

const push = vi.fn();
const replace = vi.fn();

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
  configurable: true,
  value: function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  },
});
Object.defineProperty(HTMLDialogElement.prototype, "close", {
  configurable: true,
  value: function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  },
});

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn().mockResolvedValue({ patients: [] }),
}));

vi.mock("@/components/ui/feedback-message", () => ({
  FeedbackMessage: ({ message }: { message: string }) => <div role="status">{message}</div>,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => new URLSearchParams(),
}));

function renderRegistration() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <OPDVisitRegistrationPage />
    </QueryClientProvider>
  );
}

describe("OPDVisitRegistrationPage", () => {
  it("shows a patient's photo in the selected summary and More details", async () => {
    const patient = {
      id: "patient-uuid",
      firstName: "Ama",
      otherName: "Yaa",
      lastName: "Mensah",
      patientId: "PT-12/2026",
      phone: "0".repeat(10),
      town: "Odoben",
      area: "Awendadze",
      imageUrl: "/uploads/patients/ama.jpg",
    };
    vi.mocked(apiRequest).mockResolvedValueOnce({ patients: [patient] });
    vi.mocked(apiRequest).mockResolvedValueOnce(patient);

    renderRegistration();

    fireEvent.change(screen.getByRole("combobox", { name: "Search for a patient" }), {
      target: { value: "Ama" },
    });
    const patientMatch = await screen.findByRole("option", { name: /Ama Yaa Mensah/ });
    expect(patientMatch).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Odoben")).toBeInTheDocument();
    expect(screen.getByText("Awendadze")).toBeInTheDocument();
    fireEvent.click(patientMatch);

    expect(replace).toHaveBeenCalledWith("/opd-visits/register?patientId=patient-uuid", { scroll: false });
    expect(screen.getAllByText("Ama Yaa Mensah")).toHaveLength(1);
    expect(screen.getAllByText("OPD No. 12/2026")).toHaveLength(1);
    expect(screen.getAllByAltText("")).toHaveLength(1);
    expect(screen.getByAltText("")).toHaveAttribute("src", expect.stringContaining("/uploads/patients/ama.jpg"));
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();

    const previousPosition = document.body.style.position;
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    fireEvent.click(screen.getAllByRole("button", { name: "More details for Ama Yaa Mensah" }).at(-1)!);
    expect(screen.getAllByAltText("")).toHaveLength(2);
    expect(screen.getByText("First name").parentElement).toHaveTextContent("Ama");
    expect(screen.getByText("Other name").parentElement).toHaveTextContent("Yaa");
    expect(screen.getByText("Last name").parentElement).toHaveTextContent("Mensah");
    const detailsDialog = document.querySelector("dialog");
    expect(detailsDialog?.querySelector("img")).not.toBeNull();
    expect(detailsDialog?.querySelector('button[aria-label="Close details"]')).toHaveClass(
      "rounded-full",
      "bg-card",
      "shadow-md"
    );
    expect(detailsDialog).toHaveClass("m-auto", "opd-patient-details-dialog");
    expect(detailsDialog).not.toHaveClass("max-sm:mt-auto", "max-sm:mb-0", "max-sm:rounded-b-none");
    expect(detailsDialog?.querySelector("#patient-details-title")).toHaveClass("break-words");
    expect(detailsDialog?.firstElementChild).toHaveClass("shrink-0");
    expect(detailsDialog?.querySelector("dl")).toHaveClass("grid-cols-1", "sm:grid-cols-2");
    expect(detailsDialog?.children[1]).toHaveClass("min-h-0", "flex-1", "overflow-y-auto", "overscroll-contain");
    expect(detailsDialog?.lastElementChild).toHaveClass("shrink-0");
    expect(document.activeElement).toBe(detailsDialog?.querySelector("#patient-details-title"));
    expect(document.body.style.position).toBe("fixed");
    fireEvent.click(detailsDialog?.querySelector('button[aria-label="Close details"]') as HTMLButtonElement);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Ama Yaa Mensah" })).not.toBeInTheDocument());
    expect(document.body.style.position).toBe(previousPosition);
    expect(scrollTo).toHaveBeenCalled();
    scrollTo.mockRestore();
  });
});
