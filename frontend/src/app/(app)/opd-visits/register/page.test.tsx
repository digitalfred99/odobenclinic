import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import OPDVisitRegistrationPage from "./page";

const push = vi.fn();
const replace = vi.fn();

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
  it("registers an attendance, confirms success, and allows an undo", async () => {
    const patient = {
      id: "patient-uuid",
      firstName: "Ama",
      lastName: "Mensah",
      patientId: "PT-12/2026",
      phone: "0241234567",
      town: "Odoben",
      area: "Awendadze",
    };
    const visit = {
      id: "visit-uuid",
      date: "2026-10-10",
      newReturning: "new",
      patient,
    };
    vi.mocked(apiRequest).mockResolvedValueOnce({ patients: [patient] });
    vi.mocked(apiRequest).mockResolvedValueOnce(patient);
    vi.mocked(apiRequest).mockResolvedValueOnce(visit);
    vi.mocked(apiRequest).mockResolvedValueOnce({});

    renderRegistration();

    fireEvent.change(screen.getByRole("textbox", { name: "Search patients for an OPD visit" }), {
      target: { value: "Ama" },
    });
    const patientMatch = await screen.findByRole("button", { name: /Ama Mensah/ });
    expect(patientMatch).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Odoben")).toBeInTheDocument();
    expect(screen.getByText("Awendadze")).toBeInTheDocument();
    fireEvent.click(patientMatch);

    expect(screen.getByText("Selected")).toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/opd-visits/register?patientId=patient-uuid");
    expect(screen.getAllByText("Ama Mensah")).toHaveLength(2);
    expect(screen.getAllByText("OPD No. 12/2026")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Register visit" }));

    expect(await screen.findByText("Okay · attendance saved")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo last visit" })).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith("/opd-visits", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"patient":"patient-uuid"'),
    }));

    fireEvent.click(screen.getByRole("button", { name: "Undo last visit" }));
    expect(screen.getByRole("alertdialog", { name: "Undo the last OPD visit?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo visit" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/opd-visits", {
        method: "DELETE",
        body: JSON.stringify({ ids: ["visit-uuid"] }),
      });
    });
    expect(await screen.findByText("The last OPD visit was successfully undone.")).toBeInTheDocument();
  });
});
