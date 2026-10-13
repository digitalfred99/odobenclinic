import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import PatientDetailPage from "./page";

const push = vi.fn();

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "patient-uuid" }),
  useRouter: () => ({ push }),
}));

function renderPatientDetail() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <PatientDetailPage />
    </QueryClientProvider>
  );
}

describe("PatientDetailPage", () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
    push.mockReset();
  });

  it("shows the matching detail skeleton while the patient loads", () => {
    vi.mocked(apiRequest).mockReturnValue(new Promise(() => {}));
    renderPatientDetail();

    expect(screen.getByRole("region", { name: "Loading patient details" })).toHaveAttribute("aria-busy", "true");
  });

  it("renders patient details in grouped cards after loading", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({
      id: "patient-uuid",
      firstName: "Ama",
      lastName: "Mensah",
      patientId: "PT-12/2026",
      dateOfBirth: "1990-04-15",
      age: 36,
      phone: "0".repeat(10),
      ghCardNumber: "GHA-123456789-0",
      nhisNumber: "56738945",
      gender: "female",
      maritalStatus: "married",
      region: "Greater Accra",
      district: "Accra Metro",
      town: "Accra",
      area: "Osu",
      createdAt: "2026-10-04T12:34:00.000Z",
      createdBy: { id: "staff-id", firstName: "Kojo", lastName: "Owusu" },
    });
    vi.mocked(apiRequest).mockResolvedValueOnce({ opdVisits: [], pagination: { total: 0, totalPages: 1 } });

    renderPatientDetail();

    expect(await screen.findByRole("heading", { level: 2, name: "Ama Mensah" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Personal details" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Contact & location" })).toBeInTheDocument();
    expect(screen.getByText("GHA-123456789-0")).toBeInTheDocument();
    expect(screen.getByText("56738945")).toBeInTheDocument();
    expect(screen.getByText("Record created")).toBeInTheDocument();
    expect(screen.getByText("This patient ID is permanent and is also the OPD No. used for every visit.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Register OPD visit" }));
    expect(push).toHaveBeenCalledWith("/opd-visits/register?patientId=patient-uuid");
  });

  it("displays the patient photo when one is available", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({
      id: "patient-uuid",
      firstName: "Ama",
      lastName: "Mensah",
      imageUrl: "/uploads/patients/ama.jpg",
    });
    vi.mocked(apiRequest).mockResolvedValueOnce({ opdVisits: [], pagination: { total: 0, totalPages: 1 } });

    renderPatientDetail();

    const photo = await screen.findByRole("img", { name: "Patient photo of Ama Mensah" });
    expect(photo).toHaveAttribute("src", expect.stringContaining("/uploads/patients/ama.jpg"));
  });

  it("shows visit remarks and paginates the patient's attendance history", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({
      id: "patient-uuid",
      firstName: "Ama",
      lastName: "Mensah",
      patientId: "PT-12/2026",
    });
    vi.mocked(apiRequest).mockResolvedValueOnce({
      opdVisits: [{
        id: "visit-1",
        date: "2026-10-09",
        remarks: "Review appointment",
        newReturning: "returning",
        createdAt: "2026-10-09T08:45:00.000Z",
        patient: { id: "patient-uuid", firstName: "Ama", lastName: "Mensah" },
      }],
      pagination: { page: 1, limit: 20, total: 21, totalPages: 2 },
    });

    renderPatientDetail();

    expect(await screen.findByText("Review appointment")).toBeInTheDocument();
    expect(screen.getByText("Friday, 9 October 2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next visit history page" })).toBeEnabled();
  });
});
