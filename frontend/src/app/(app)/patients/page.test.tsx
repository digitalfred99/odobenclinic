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
    initialValues,
    onValuesChange,
    onFieldChange,
    variant,
    manualNumberError,
  }: {
    onSubmit: (values: PatientFormValues, photo: File | null) => Promise<boolean | void> | boolean | void;
    initialValues?: Partial<PatientFormValues>;
    onValuesChange?: (values: PatientFormValues) => void;
    onFieldChange?: (field: keyof PatientFormValues, value: string) => void;
    variant?: "with-opd" | "clinic-record" | "edit";
    manualNumberError?: string | null;
  }) => (
    <div>
      <p>Patient registration fields</p>
      <label>
        Test first name
        <input
          aria-label="Test first name"
          value={initialValues?.firstName ?? ""}
          onChange={(event) => onValuesChange?.({
            ...initialValues,
            firstName: event.currentTarget.value,
          } as PatientFormValues)}
        />
      </label>
      <label>
        Test age correction
        <input
          aria-label="Test age correction"
          defaultValue="125"
          onChange={(event) => onFieldChange?.("age", event.currentTarget.value)}
        />
      </label>
      {manualNumberError ? <p role="alert">{manualNumberError}</p> : null}
      <button
        type="button"
        onClick={() => void onSubmit({
          firstName: "Ama",
          lastName: "Mensah",
          age: 36,
          gender: "female",
          maritalStatus: "single",
          religion: "christianity",
          ...(variant === "clinic-record"
            ? { year: 2026, positionInYear: 45 }
            : { visitDate: "2026-10-20" }),
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
          religion: "christianity",
          ...(variant === "clinic-record"
            ? { year: 2026, positionInYear: 45 }
            : { visitDate: "2026-10-20" }),
        }, new File(["photo"], "patient.png", { type: "image/png" }))}
      >
        Submit test patient with photo
      </button>
      {variant === "with-opd" ? (
        <button
          type="button"
          onClick={() => void onSubmit({
            firstName: "Ama",
            lastName: "Mensah",
            age: 36,
            gender: "female",
            maritalStatus: "single",
            religion: "christianity",
            visitDate: "2026-10-20",
            visitRemarks: "Late entry",
          }, null)}
        >
          Submit test patient with visit remarks
        </button>
      ) : null}
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
    expect(screen.getByText(/Create a permanent patient record and record their first OPD visit/)).toBeInTheDocument();
    expect(screen.getByText("Patient registration fields")).toBeInTheDocument();
  });

  it("keeps Close visible and clears the validation banner when the age is corrected", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <PatientsPage />
      </QueryClientProvider>
    );
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      "/patients",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    ));
    vi.mocked(apiRequest).mockRejectedValueOnce(
      new ApiError(
        "The provided age (19) is inconsistent with the provided dateOfBirth (implies age 0). Please correct one of them.",
        400
      )
    );

    fireEvent.click(screen.getByRole("button", { name: "Register new patient" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit test patient" }));

    expect(await screen.findByText(/provided age \(19\) is inconsistent/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Close patient registration/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Close patient registration/ })).toHaveClass(
      "rounded-full",
      "bg-card",
      "shadow-md"
    );

    fireEvent.change(screen.getByLabelText("Test age correction"), { target: { value: "" } });

    await waitFor(() => {
      expect(screen.queryByText(/provided age \(19\) is inconsistent/)).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Close patient registration/ })).toBeVisible();
  });

  it("preserves entered fields after closing and reopening the registration form", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <PatientsPage />
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Register new patient" }));
    fireEvent.change(screen.getByLabelText("Test first name"), { target: { value: "Ama" } });
    fireEvent.click(document.querySelector(".patient-registration-backdrop") as HTMLElement);

    fireEvent.click(screen.getByRole("button", { name: "Register new patient" }));
    expect(screen.getByLabelText("Test first name")).toHaveValue("Ama");

    fireEvent.click(screen.getByRole("button", { name: "Close patient registration" }));
    fireEvent.click(screen.getByRole("button", { name: "Register new patient" }));
    expect(screen.getByLabelText("Test first name")).toHaveValue("Ama");
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
    expect(screen.getByText(/Add a patient already recorded in your clinic books\. This does not create an OPD visit\./)).toBeInTheDocument();
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
    vi.mocked(apiRequest).mockResolvedValueOnce({
      patient,
      opdVisit: { id: "visit-uuid", date: "2026-10-20", newReturning: "new" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Register new patient" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit test patient" }));

    expect(await screen.findByText("Patient registered: PT-12/2026. First OPD visit recorded.")).toBeInTheDocument();
    const request = vi.mocked(apiRequest).mock.calls.find(([path, options]) =>
      path === "/patients/with-opd" && options?.method === "POST"
    );
    expect(request?.[1]?.method).toBe("POST");
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({
        patient: {
          firstName: "Ama",
          lastName: "Mensah",
          gender: "female",
          maritalStatus: "single",
          religion: "christianity",
          age: 36,
        },
        opdVisit: { date: "2026-10-20" },
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
      opdVisit: { id: "visit-uuid", date: "2026-10-20", newReturning: "new" },
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
      religion: "christianity",
    });
    expect(JSON.parse(String(formData.get("opdVisit")))).toEqual({ date: "2026-10-20" });
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

  it("includes visit remarks only when provided", async () => {
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
        opdVisit: { id: "visit-uuid", date: "2026-10-20", newReturning: "new" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Register new patient" }));
      fireEvent.click(screen.getByRole("button", { name: "Submit test patient with visit remarks" }));

      await waitFor(() => {
        const request = vi.mocked(apiRequest).mock.calls.find(([path, options]) =>
          path === "/patients/with-opd" && options?.method === "POST"
        );
        expect(JSON.parse(String(request?.[1]?.body))).toEqual({
          patient: {
            firstName: "Ama",
            lastName: "Mensah",
            gender: "female",
            maritalStatus: "single",
            religion: "christianity",
            age: 36,
          },
          opdVisit: { date: "2026-10-20", remarks: "Late entry" },
        });
      });
  });

  it("adds a clinic-book record with a flat JSON request and no visit", async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      render(
        <QueryClientProvider client={queryClient}>
          <PatientsPage />
        </QueryClientProvider>
      );
      vi.mocked(apiRequest).mockResolvedValueOnce({
        id: "patient-uuid",
        firstName: "Ama",
        lastName: "Mensah",
        patientId: "PT-45/2026",
      });

      fireEvent.click(screen.getByRole("button", { name: "Add from clinic records" }));
      fireEvent.click(screen.getByRole("button", { name: "Submit test patient" }));

      expect(await screen.findByText("Patient added from clinic records: PT-45/2026. No OPD visit was created.")).toBeInTheDocument();
      const request = vi.mocked(apiRequest).mock.calls.find(([path, options]) =>
        path === "/patients" && options?.method === "POST"
      );
      expect(JSON.parse(String(request?.[1]?.body))).toEqual({
          firstName: "Ama",
          lastName: "Mensah",
          gender: "female",
          maritalStatus: "single",
          religion: "christianity",
          age: 36,
          year: 2026,
          positionInYear: 45,
      });
      expect(vi.mocked(apiRequest).mock.calls.some(([path]) => path === "/opd-visits")).toBe(false);
  });

  it("adds clinic-book photos as separate multipart fields with a manual number", async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      render(
        <QueryClientProvider client={queryClient}>
          <PatientsPage />
        </QueryClientProvider>
      );
      vi.mocked(apiRequest).mockResolvedValueOnce({
        id: "patient-uuid",
        firstName: "Ama",
        lastName: "Mensah",
        patientId: "PT-45/2026",
      });

      fireEvent.click(screen.getByRole("button", { name: "Add from clinic records" }));
      fireEvent.click(screen.getByRole("button", { name: "Submit test patient with photo" }));

      await screen.findByText("Patient added from clinic records: PT-45/2026. No OPD visit was created.");
      const request = vi.mocked(apiRequest).mock.calls.find(([path, options]) =>
        path === "/patients" && options?.method === "POST"
      );
      expect(request?.[1]?.body).toBeInstanceOf(FormData);
      const body = request?.[1]?.body as FormData;
      expect(body.get("firstName")).toBe("Ama");
      expect(body.get("religion")).toBe("christianity");
      expect(body.get("age")).toBe("36");
      expect(body.get("year")).toBe("2026");
      expect(body.get("positionInYear")).toBe("45");
      expect(body.get("patient")).toBeNull();
      expect(body.get("opdVisit")).toBeNull();
      expect(body.get("image")).toMatchObject({ name: "patient.png", type: "image/png" });
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
    expect(screen.getByText("An existing patient (ID: PT-12/2026) closely matches the information provided.")).toBeInTheDocument();
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
      opdVisit: { id: "visit-uuid", date: "2026-10-20", newReturning: "new" },
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
    const registrationRequest = vi.mocked(apiRequest).mock.calls.find(([path, options]) =>
      path === "/patients/with-opd" && options?.method === "POST" &&
      String(options.body).includes("confirmedDuplicatePatientId")
    );
    expect(JSON.parse(String(registrationRequest?.[1]?.body))).toEqual({
        patient: {
          firstName: "Ama",
          lastName: "Mensah",
          gender: "female",
          maritalStatus: "single",
          religion: "christianity",
          age: 36,
          confirmedDuplicatePatientId: "PT-12/2026",
        },
        opdVisit: { date: "2026-10-20" },
    });
  });

  it("hard-blocks duplicate government IDs without offering confirmation", async () => {
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
    expect(await screen.findByText("An existing patient (ID: PT-12/2026) has the same Ghana Card or NHIS number.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Possible duplicate" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept new record" })).not.toBeInTheDocument();
  });

  it("highlights manual patient-number inputs when the number is already in use", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <PatientsPage />
      </QueryClientProvider>
    );
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      "/patients",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    ));
    vi.mocked(apiRequest).mockRejectedValueOnce(
      new ApiError("Patient ID PT-45/2026 is already in use", 409, "patient_id_exists")
    );

    fireEvent.click(screen.getByRole("button", { name: "Add from clinic records" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit test patient" }));

    expect(await screen.findByText("This patient number is already in use.")).toBeInTheDocument();
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
