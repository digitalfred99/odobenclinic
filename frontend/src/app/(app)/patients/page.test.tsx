import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest } from "@/lib/api";
import type { PatientFormValues } from "@/schemas/patient";
import PatientsPage from "./page";

vi.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    key?: string;

    constructor(message: string, status: number, key?: string) {
      super(message);
      this.status = status;
      this.key = key;
    }
  },
  apiRequest: vi.fn().mockResolvedValue({ patients: [] }),
}));

vi.mock("@/components/features/patients/patient-form", () => ({
  PatientForm: ({
    onSubmit,
  }: {
    onSubmit: (values: PatientFormValues, photo: File | null) => Promise<boolean | void> | boolean | void;
  }) => (
    <div>
      <p>Patient registration fields</p>
      <button
        type="button"
        onClick={() => void onSubmit({
          firstName: "Ama",
          lastName: "Mensah",
          age: 36,
          gender: "female",
          maritalStatus: "single",
        }, null)}
      >
        Submit test patient
      </button>
      <button
        type="button"
        onClick={() => void onSubmit({
          firstName: "Ama",
          lastName: "Mensah",
          age: 36,
          gender: "female",
          maritalStatus: "single",
        }, new File(["photo"], "patient.png", { type: "image/png" }))}
      >
        Submit test patient with photo
      </button>
    </div>
  ),
}));

vi.mock("@/components/ui/feedback-message", () => ({
  FeedbackMessage: ({ message }: { message: string }) => <div role="status">{message}</div>,
}));

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  register: "",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
  useSearchParams: () => new URLSearchParams(navigation.register ? `register=${navigation.register}` : ""),
}));

beforeEach(() => {
  vi.mocked(apiRequest).mockClear();
  navigation.register = "";
  navigation.push.mockClear();
  navigation.replace.mockClear();
  window.history.replaceState(null, "", "/patients");
});

describe("PatientsPage registration actions", () => {
  it("opens a focused form for a new patient", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <PatientsPage />
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Register new patient" }));

    expect(screen.getByRole("dialog", { name: "Register new patient" })).toBeInTheDocument();
    expect(screen.getByText("Create a permanent patient record and record their first OPD visit.")).toBeInTheDocument();
    expect(screen.getByText("Patient registration fields")).toBeInTheDocument();
  });

  it("opens the registration form directly when requested from the dashboard", async () => {
    navigation.register = "new";
    window.history.replaceState(null, "", "/patients?register=new");
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <PatientsPage />
      </QueryClientProvider>
    );

    expect(await screen.findByRole("dialog", { name: "Register new patient" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close patient registration" }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/patients", { scroll: false }));
  });

  it("distinguishes adding an existing clinic record from a new registration", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <PatientsPage />
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Add from clinic records" }));

    expect(screen.getByRole("dialog", { name: "Add from clinic records" })).toBeInTheDocument();
    expect(screen.getByText("Add a patient already recorded in your clinic books. This does not create an OPD visit.")).toBeInTheDocument();
  });

  it("uses the transactional endpoint to register a new patient with their first visit", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <PatientsPage />
      </QueryClientProvider>
    );

    const patient = {
      id: "patient-uuid",
      firstName: "Ama",
      lastName: "Mensah",
      patientId: "PT-12/2026",
    };
    vi.mocked(apiRequest).mockResolvedValueOnce({ patient });

    fireEvent.click(screen.getByRole("button", { name: "Register new patient" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit test patient" }));

    expect(await screen.findByText("Patient registered: PT-12/2026. First OPD visit recorded.")).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith("/patients/with-opd", {
      method: "POST",
      body: JSON.stringify({
        patient: {
          firstName: "Ama",
          lastName: "Mensah",
          age: 36,
          gender: "female",
          maritalStatus: "single",
        },
      }),
    });
  });

  it("uses the transactional endpoint with multipart data when registering a patient with a photo", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <PatientsPage />
      </QueryClientProvider>
    );

    vi.mocked(apiRequest).mockResolvedValueOnce({
      patient: {
        id: "patient-uuid",
        firstName: "Ama",
        lastName: "Mensah",
        patientId: "PT-12/2026",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Register new patient" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit test patient with photo" }));

    expect(await screen.findByText("Patient registered: PT-12/2026. First OPD visit recorded.")).toBeInTheDocument();

    const registrationCall = vi.mocked(apiRequest).mock.calls.find(([path]) => path === "/patients/with-opd");
    if (!registrationCall) {
      throw new Error("Expected the transactional patient registration request");
    }
    const [path, request] = registrationCall;
    expect(path).toBe("/patients/with-opd");
    expect(request?.method).toBe("POST");
    expect(request?.body).toBeInstanceOf(FormData);

    const formData = request?.body as FormData;
    expect(JSON.parse(String(formData.get("patient")))).toEqual({
      firstName: "Ama",
      lastName: "Mensah",
      age: 36,
      gender: "female",
      maritalStatus: "single",
    });
    expect(formData.get("image")).toMatchObject({
      name: "patient.png",
      type: "image/png",
    });
    expect(
      vi.mocked(apiRequest).mock.calls.some(([requestPath, options]) =>
        requestPath === "/patients" && options?.method === "POST"
      )
    ).toBe(false);
    expect(
      vi.mocked(apiRequest).mock.calls.some(([requestPath]) => requestPath === "/opd-visits")
    ).toBe(false);
  });

  it("opens comparison in a second popup and returns to the duplicate card when closed", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <PatientsPage />
      </QueryClientProvider>
    );
    vi.mocked(apiRequest).mockRejectedValueOnce(
      new ApiError(
        "An existing patient (ID: PT-12/2026) closely matches the information provided.",
        409,
        "patient_exists"
      )
    );

    fireEvent.click(screen.getByRole("button", { name: "Register new patient" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit test patient" }));

    expect(await screen.findByRole("dialog", { name: "Possible duplicate" })).toBeInTheDocument();
    expect(screen.getByText("OPD No. PT-12/2026")).toBeInTheDocument();

    const patient = {
      id: "patient-uuid",
      firstName: "Ama",
      lastName: "Mensah",
      patientId: "PT-12/2026",
      dateOfBirth: "1990-04-12",
      age: 36,
      phone: "0".repeat(10),
      gender: "female" as const,
      maritalStatus: "single" as const,
    };
    vi.mocked(apiRequest).mockResolvedValueOnce({ patients: [patient] });

    fireEvent.click(screen.getByRole("button", { name: "Compare persons" }));
    expect(await screen.findByRole("dialog", { name: "Compare persons" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "New details" })).toHaveTextContent("Ama");
    expect(screen.getByRole("region", { name: "Existing record" })).toHaveTextContent("PT-12/2026");
    expect(apiRequest).toHaveBeenCalledWith("/patients?patientId=PT-12%2F2026&limit=100&page=1");

    fireEvent.click(screen.getByRole("button", { name: "Close comparison" }));
    expect(screen.queryByRole("dialog", { name: "Compare persons" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Possible duplicate" })).toBeInTheDocument();
  });

  it("accepts a reviewed demographic match and resubmits the entered details", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <PatientsPage />
      </QueryClientProvider>
    );
    vi.mocked(apiRequest).mockRejectedValueOnce(
      new ApiError(
        "An existing patient (ID: PT-12/2026) closely matches the information provided.",
        409,
        "patient_exists"
      )
    );
    vi.mocked(apiRequest).mockResolvedValueOnce({
      patients: [{
        id: "patient-uuid",
        firstName: "Ama",
        lastName: "Mensah",
        patientId: "PT-12/2026",
        age: 36,
        gender: "female",
        maritalStatus: "single",
      }],
    });
    vi.mocked(apiRequest).mockResolvedValueOnce({
      patient: {
        id: "new-patient-uuid",
        firstName: "Ama",
        lastName: "Mensah",
        patientId: "PT-13/2026",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Register new patient" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit test patient" }));

    expect(await screen.findByRole("dialog", { name: "Possible duplicate" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Compare persons" }));
    expect(await screen.findByRole("dialog", { name: "Compare persons" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Accept new record" }));

    expect(screen.getByRole("dialog", { name: "Register new patient" })).toBeInTheDocument();
    expect(screen.getByText("Patient registration fields")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Submit the form again to register this person.");

    fireEvent.click(screen.getByRole("button", { name: "Submit test patient" }));

    expect(await screen.findByText("Patient registered: PT-13/2026. First OPD visit recorded.")).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith("/patients/with-opd", {
      method: "POST",
      body: JSON.stringify({
        patient: {
          firstName: "Ama",
          lastName: "Mensah",
          age: 36,
          gender: "female",
          maritalStatus: "single",
          confirmedDuplicatePatientId: "PT-12/2026",
        },
      }),
    });
  });

  it("does not allow accepting a duplicate government ID", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <PatientsPage />
      </QueryClientProvider>
    );
    vi.mocked(apiRequest).mockRejectedValueOnce(
      new ApiError(
        "An existing patient (ID: PT-12/2026) has the same Ghana Card or NHIS number.",
        409,
        "patient_government_id_exists"
      )
    );
    vi.mocked(apiRequest).mockResolvedValueOnce({
      patients: [{
        id: "patient-uuid",
        firstName: "Ama",
        lastName: "Mensah",
        patientId: "PT-12/2026",
      }],
    });

    fireEvent.click(screen.getByRole("button", { name: "Register new patient" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit test patient" }));
    expect(await screen.findByRole("dialog", { name: "Possible duplicate" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Compare persons" }));
    expect(await screen.findByRole("dialog", { name: "Compare persons" })).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Accept new record" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("cannot be accepted");
  });

  it("ignores the new record and closes registration", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <PatientsPage />
      </QueryClientProvider>
    );
    vi.mocked(apiRequest).mockRejectedValueOnce(
      new ApiError(
        "An existing patient (ID: PT-12/2026) closely matches the information provided.",
        409,
        "patient_exists"
      )
    );
    vi.mocked(apiRequest).mockResolvedValueOnce({
      patients: [{
        id: "patient-uuid",
        firstName: "Ama",
        lastName: "Mensah",
        patientId: "PT-12/2026",
      }],
    });

    fireEvent.click(screen.getByRole("button", { name: "Register new patient" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit test patient" }));
    expect(await screen.findByRole("dialog", { name: "Possible duplicate" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Compare persons" }));
    expect(await screen.findByRole("dialog", { name: "Compare persons" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ignore new record" }));

    expect(screen.queryByRole("dialog", { name: "Register new patient" })).not.toBeInTheDocument();
    expect(await screen.findByRole("status")).toHaveTextContent("No new patient was added.");
  });
});
