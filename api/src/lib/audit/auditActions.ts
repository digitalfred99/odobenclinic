// Central registry of audit action strings. Keeping these as constants
// (rather than inline string literals at each call site) avoids typos

// silently producing unqueryable audit records.
export const AuditAction = {
  PATIENT_REGISTERED: "PATIENT_REGISTERED",
  PATIENT_PROFILE_UPDATED: "PATIENT_PROFILE_UPDATED",
  PATIENT_DELETED: "PATIENT_DELETED",

  OPD_VISIT_CREATED: "OPD_VISIT_CREATED",
  OPD_VISIT_UPDATED: "OPD_VISIT_UPDATED",
  OPD_VISIT_DELETED: "OPD_VISIT_DELETED",

  USER_REGISTERED: "USER_REGISTERED",
  USER_DEACTIVATED: "USER_DEACTIVATED",
  USER_EDITED: "USER_EDITED",
  USER_DELETED: "USER_DELETED",
  PASSWORD_CHANGED: "PASSWORD_CHANGED",
  PHONE_CHANGED: "PHONE_CHANGED",
  EMAIL_CHANGED: "EMAIL_CHANGED",

  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILED: "LOGIN_FAILED",
  LOGOUT: "LOGOUT",
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

export const AuditEntityType = {
  USER: "USER",
  PATIENT: "PATIENT",
  OPDVISIT: "OPDVISIT",
} as const;

export type AuditEntityTypeValue = (typeof AuditEntityType)[keyof typeof AuditEntityType];
