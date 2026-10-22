import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import { PatientSearchList } from "./patient-search";

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn().mockResolvedValue({ patients: [] }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function renderPatientSearch() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <PatientSearchList />
    </QueryClientProvider>
  );
}

describe("PatientSearchList filters", () => {
  it("shows patient-card skeletons while results are loading", () => {
    vi.mocked(apiRequest).mockReturnValue(new Promise(() => {}));
    renderPatientSearch();

    expect(screen.getByRole("status", { name: "Loading patients" })).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("Loading patients...")).not.toBeInTheDocument();
  });

  it("opens filter controls and applies only supported patient-list filters", async () => {
    renderPatientSearch();

    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.getByRole("form", { name: "Filter patients" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Gender"), { target: { value: "female" } });
    fireEvent.change(screen.getByLabelText("Marital status"), { target: { value: "married" } });
    fireEvent.change(screen.getByLabelText("Religion"), { target: { value: "traditional" } });
    fireEvent.change(screen.getByLabelText("region"), { target: { value: " Greater Accra " } });
    fireEvent.change(screen.getByLabelText("Patient ID (OPD No.)"), { target: { value: "PT-12/2026" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/patients?gender=female&maritalStatus=married&religion=traditional&region=Greater+Accra&patientId=PT-12%2F2026",
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
    expect(screen.queryByRole("form", { name: "Filter patients" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filters (5)" })).toBeInTheDocument();
  });

  it("clears active filters and reloads the unfiltered list", async () => {
    renderPatientSearch();

    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.change(screen.getByLabelText("area"), { target: { value: "Osu" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/patients?area=Osu",
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Filters (1)" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/patients",
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
    expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();
  });

  it("shows the patient's town and area on the search result card", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({
      patients: [{
        id: "patient-1",
        firstName: "Ama",
        otherName: "Yaa",
        lastName: "Mensah",
        patientId: "PT-12/2026",
        town: "Odoben",
        area: "Awendadze",
      }],
    });

    renderPatientSearch();

    expect(await screen.findByText("Ama Yaa Mensah")).toBeInTheDocument();
    expect(await screen.findByText("OPD No. 12/2026 • Odoben • Awendadze")).toBeInTheDocument();
  });

  it("shows optional email, postal address, occupation, and religion when available", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({
      patients: [{
        id: "patient-1",
        firstName: "Ama",
        lastName: "Mensah",
        email: "ama@example.com",
        postalAddress: "P.O. Box 12",
        occupation: "Teacher",
        religion: "christianity",
      }],
    });

    renderPatientSearch();

    expect(await screen.findByText("ama@example.com • P.O. Box 12 • Teacher • Christianity")).toBeInTheDocument();
  });
});
