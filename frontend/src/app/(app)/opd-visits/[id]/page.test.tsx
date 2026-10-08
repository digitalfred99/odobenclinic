import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import OPDVisitDetailPage from "./page";

const push = vi.fn();

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn().mockResolvedValue({
    id: "visit-uuid",
    date: "2026-10-04",
    remarks: "Follow-up attendance",
    newReturning: "returning",
    patient: {
      id: "patient-uuid",
      patientId: "PT-12/2026",
      firstName: "Ama",
      lastName: "Mensah",
      phone: "0241234567",
      area: "Osu",
    },
    createdBy: { id: "staff-uuid", firstName: "Kojo", lastName: "Owusu" },
  }),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "visit-uuid" }),
  useRouter: () => ({ push }),
}));

function renderVisitDetail() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <OPDVisitDetailPage />
    </QueryClientProvider>
  );
}

describe("OPDVisitDetailPage", () => {
  it("loads and displays the full visit summary and links to its patient", async () => {
    renderVisitDetail();

    expect(await screen.findByRole("heading", { level: 2, name: "Ama Mensah" })).toBeInTheDocument();
    expect(screen.getByText("PT-12/2026")).toBeInTheDocument();
    expect(screen.getByText("Sunday, 4 October 2026")).toBeInTheDocument();
    expect(screen.getByText("Follow-up attendance")).toBeInTheDocument();
    expect(screen.getByText("Kojo Owusu")).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith(
      "/opd-visits/visit-uuid",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );

    fireEvent.click(screen.getByRole("button", { name: "View patient record" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/patients/patient-uuid"));
  });
});
