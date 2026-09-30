// Sections below cover this project's actual domain (patient
// registration / OPD / users / audit). This previously also carried
// entire sections (tutor profiles, lesson requests, reviews, GHS
// payments, SMS/notifications, file uploads, disciplinary actions) that
// belonged to an unrelated tutoring-marketplace project and were never
// referenced anywhere in this codebase — removed. That block also had
// two real bugs: several codes shared the literal placeholder
// "GNE_E00XX" (never filled in), and DUPLICATE_SERVICE_AREA /
// INVALID_VERIFICATION_STATE were both assigned "GNE_E0407".
export const ErrorCodes = {
  // ── General / system ─────────────────────────────────────────
  GENERAL_SYSTEM_ERROR:          { code: "GNE_E0001", label: "GENERAL_SYSTEM_ERROR" },
  INVALID_INPUT:                 { code: "GNE_E0002", label: "INVALID_INPUT" },
  VALIDATION_FAILED:             { code: "GNE_E0003", label: "VALIDATION_FAILED" },
  EMPTY_REQUEST:                 { code: "GNE_E0004", label: "EMPTY_REQUEST" },
  ID_REQUIRED:                   { code: "GNE_E0005", label: "ID_REQUIRED" },
  INPUT_REQUIRED:                { code: "GNE_E0006", label: "INPUT_REQUIRED" },
  RESOURCE_NOT_FOUND:            { code: "GNE_E0007", label: "RESOURCE_NOT_FOUND" },
  RECORD_NOT_FOUND:              { code: "GNE_E0008", label: "RECORD_NOT_FOUND" },
  RECORD_ALREADY_EXISTS:         { code: "GNE_E0009", label: "RECORD_ALREADY_EXISTS" },
  DUPLICATE_RESOURCE:            { code: "GNE_E0010", label: "DUPLICATE_RESOURCE" },
  DATABASE_ERROR:                { code: "GNE_E0011", label: "DATABASE_ERROR" },
  INTEGRITY_CONSTRAINT_VIOLATION:{ code: "GNE_E0012", label: "INTEGRITY_CONSTRAINT_VIOLATION" },
  CONCURRENT_MODIFICATION:       { code: "GNE_E0013", label: "CONCURRENT_MODIFICATION" },
  PRECONDITION_FAILED:           { code: "GNE_E0014", label: "PRECONDITION_FAILED" },
  INVALID_STATE:                 { code: "GNE_E0015", label: "INVALID_STATE" },
  OPERATION_TIMEOUT:             { code: "GNE_E0016", label: "OPERATION_TIMEOUT" },
  SERVICE_UNAVAILABLE:           { code: "GNE_E0017", label: "SERVICE_UNAVAILABLE" },
  UNSUPPORTED_OPERATION:         { code: "GNE_E0018", label: "UNSUPPORTED_OPERATION" },
  RATE_LIMIT_EXCEEDED:           { code: "GNE_E0019", label: "RATE_LIMIT_EXCEEDED" },
  CONFIGURATION_ERROR:           { code: "GNE_E0020", label: "CONFIGURATION_ERROR" },

  // ── Generic CRUD ─────────────────────────────────────────────
  CREATION_FAILED:               { code: "GNE_E0100", label: "CREATION_FAILED" },
  UPDATE_FAILED:                 { code: "GNE_E0101", label: "UPDATE_FAILED" },
  DELETION_FAILED:               { code: "GNE_E0102", label: "DELETION_FAILED" },
  RETRIEVAL_FAILED:              { code: "GNE_E0103", label: "RETRIEVAL_FAILED" },
  BULK_REQUEST_ERROR:            { code: "GNE_E0104", label: "SOME_FIELDS_FAILED_TO_PROCESS" },

  // ── Auth ─────────────────────────────────────────────────────
  UNAUTHORIZED_ACCESS:           { code: "GNE_E0200", label: "UNAUTHORIZED_ACCESS" },
  PERMISSION_DENIED:             { code: "GNE_E0201", label: "PERMISSION_DENIED" },
  INVALID_CREDENTIALS:           { code: "GNE_E0202", label: "INVALID_CREDENTIALS" },
  SESSION_EXPIRED:               { code: "GNE_E0203", label: "SESSION_EXPIRED" },
  INVALID_TOKEN:                 { code: "GNE_E0204", label: "INVALID_TOKEN" },
  TOKEN_EXPIRED:                 { code: "GNE_E0205", label: "TOKEN_EXPIRED" },

  // ── Account status ───────────────────────────────────────────
  ACCOUNT_INACTIVE:              { code: "GNE_E0301", label: "ACCOUNT_INACTIVE" },
  ACCOUNT_DELETED:               { code: "GNE_E0306", label: "ACCOUNT_DELETED" },
  USER_NOT_FOUND:                { code: "GNE_E0307", label: "USER_NOT_FOUND" },

  // ── Fallback ─────────────────────────────────────────────────
  INTERNAL_SERVER_ERROR:         { code: "GNE_E9999", label: "INTERNAL_SERVER_ERROR" },
  EXTERNAL_SERVER_ERROR:         { code: "GNE_E9998", label: "EXTERNAL_SERVER_ERROR" },
  UNEXPECTED_RUNTIME_ERROR:      { code: "GNE_E9997", label: "UNEXPECTED_RUNTIME_ERROR" },
} as const;

export type ErrorCodeKey = keyof typeof ErrorCodes;
