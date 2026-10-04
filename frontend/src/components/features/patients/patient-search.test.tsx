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
    fireEvent.change(screen.getByLabelText("region"), { target: { value: " Greater Accra " } });
    fireEvent.change(screen.getByLabelText("Patient ID (OPD No.)"), { target: { value: "PT-12/2026" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/patients?gender=female&maritalStatus=married&region=Greater+Accra&patientId=PT-12%2F2026"
      );
    });
    expect(screen.queryByRole("form", { name: "Filter patients" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filters (4)" })).toBeInTheDocument();
  });

  it("clears active filters and reloads the unfiltered list", async () => {
    renderPatientSearch();

    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.change(screen.getByLabelText("area"), { target: { value: "Osu" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/patients?area=Osu");
    });

    fireEvent.click(screen.getByRole("button", { name: "Filters (1)" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/patients");
    });
    expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();
  });
});
