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
    vi.clearAllMocks();
  });

  it("shows the matching detail skeleton while the patient loads", () => {
    vi.mocked(apiRequest).mockReturnValue(new Promise(() => {}));
    renderPatientDetail();

    expect(screen.getByRole("region", { name: "Loading patient details" })).toHaveAttribute("aria-busy", "true");
  });

  it("renders patient details in grouped cards after loading", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      id: "patient-uuid",
      firstName: "Ama",
      lastName: "Mensah",
      patientId: "PT-12/2026",
      dateOfBirth: "1990-04-15",
      age: 36,
      phone: "0241234567",
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

    renderPatientDetail();

    expect(await screen.findByRole("heading", { level: 2, name: "Ama Mensah" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Personal details" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Contact & location" })).toBeInTheDocument();
    expect(screen.getByText("GHA-123456789-0")).toBeInTheDocument();
    expect(screen.getByText("56738945")).toBeInTheDocument();
    expect(screen.getByText("Record created")).toBeInTheDocument();
    expect(screen.getByText("This patient ID is permanent and is also the OPD No. used for every visit.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Register OPD visit" }));
    expect(push).toHaveBeenCalledWith("/opd-visits?patientId=patient-uuid");
  });
});
