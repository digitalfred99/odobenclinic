import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset().mockResolvedValue({ patients: [] });
  });

  it("shows patient-card skeletons while results are loading", () => {
    vi.mocked(apiRequest).mockReturnValue(new Promise(() => {}));
    renderPatientSearch();

    expect(screen.getByRole("status", { name: "Loading patients" })).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("Loading patients...")).not.toBeInTheDocument();
  });

  it("opens filter controls and applies only supported patient-list filters", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({
      patients: [{
        id: "patient-1",
        firstName: "Ama",
        lastName: "Mensah",
        region: "Greater Accra",
        district: "Accra Metro",
        town: "Accra",
        area: "Osu",
      }],
    });
    renderPatientSearch();
    await screen.findByText("Ama Mensah");

    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.getByRole("form", { name: "Filter patients" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Gender"), { target: { value: "female" } });
    fireEvent.change(screen.getByLabelText("Marital status"), { target: { value: "married" } });
    fireEvent.change(screen.getByLabelText("Religion"), { target: { value: "traditional" } });
    fireEvent.change(screen.getByLabelText("region"), { target: { value: "Greater Accra" } });
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

  it("offers location dropdowns from known patient locations and narrows them in order", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({
      patients: [
        {
          id: "patient-1",
          firstName: "Ama",
          lastName: "Mensah",
          region: "Greater Accra",
          district: "Accra Metro",
          town: "Accra",
          area: "Osu",
        },
        {
          id: "patient-2",
          firstName: "Kojo",
          lastName: "Owusu",
          region: "Central Region",
          district: "Cape Coast Metropolitan",
          town: "Cape Coast",
          area: "Abura",
        },
      ],
    });

    renderPatientSearch();
    await screen.findByText("Ama Mensah");
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));

    const region = screen.getByLabelText("region");
    const district = screen.getByLabelText("district");
    const town = screen.getByLabelText("town");
    const area = screen.getByLabelText("area");
    expect(region.tagName).toBe("SELECT");
    expect(district.tagName).toBe("SELECT");
    expect(town.tagName).toBe("SELECT");
    expect(area.tagName).toBe("SELECT");
    expect(region.querySelector('option[value="Greater Accra"]')).toBeInTheDocument();
    expect(region.querySelector('option[value="Greater Accra Region"]')).toBeInTheDocument();

    fireEvent.change(region, { target: { value: "Greater Accra" } });
    expect(district.querySelector('option[value="Accra Metro"]')).toBeInTheDocument();
    expect(district.querySelector('option[value="Cape Coast Metropolitan"]')).not.toBeInTheDocument();

    fireEvent.change(district, { target: { value: "Accra Metro" } });
    expect(town.querySelector('option[value="Accra"]')).toBeInTheDocument();
    expect(town.querySelector('option[value="Cape Coast"]')).not.toBeInTheDocument();

    fireEvent.change(town, { target: { value: "Accra" } });
    expect(area.querySelector('option[value="Osu"]')).toBeInTheDocument();
    expect(area.querySelector('option[value="Abura"]')).not.toBeInTheDocument();
  });

  it("clears active filters and reloads the unfiltered list", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({
      patients: [{ id: "patient-1", firstName: "Ama", lastName: "Mensah", region: "Greater Accra", district: "Accra Metro", town: "Accra", area: "Osu" }],
    });
    renderPatientSearch();
    await screen.findByText("Ama Mensah");

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
        region: "Greater Accra",
        district: "Accra Metro",
        town: "Odoben",
        area: "Awendadze",
        postalAddress: "P.O. Box 12",
      }],
    });

    renderPatientSearch();

    expect(await screen.findByText("Ama Yaa Mensah")).toBeInTheDocument();
    expect(await screen.findByText("OPD No. 12/2026 • Accra Metro • Odoben • Awendadze • P.O. Box 12")).toBeInTheDocument();
  });

  it("shows only recorded phone and insurance identifiers, omitting email, occupation, and religion", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({
      patients: [{
        id: "patient-1",
        firstName: "Ama",
        lastName: "Mensah",
        phone: "0240000000",
        ghCardNumber: "GHA-123456789-0",
        nhisNumber: "NHIS-12345",
        email: "ama@example.com",
        occupation: "Teacher",
        religion: "christianity",
        area: "  ",
      }],
    });

    renderPatientSearch();

    expect(await screen.findByText("GHA-123456789-0 • NHIS-12345 • 0240000000")).toBeInTheDocument();
    expect(screen.getByText("OPD No. unavailable")).toBeInTheDocument();
    expect(screen.queryByText(/P\.O\. Box/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ama@example\.com|Teacher|Christianity/)).not.toBeInTheDocument();
    expect(screen.queryByText(/•\s*•/)).not.toBeInTheDocument();
  });

  it("hides the identifier line when phone, Ghana Card, and NHIS are not recorded", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({
      patients: [{
        id: "patient-1",
        firstName: "Ama",
        lastName: "Mensah",
        phone: "  ",
        ghCardNumber: null,
        nhisNumber: undefined,
      }],
    });

    renderPatientSearch();

    expect(await screen.findByText("Ama Mensah")).toBeInTheDocument();
    expect(screen.getByText("OPD No. unavailable")).toBeInTheDocument();
    expect(screen.queryByText(/Phone:|Ghana Card:|NHIS:/)).not.toBeInTheDocument();
  });
});
