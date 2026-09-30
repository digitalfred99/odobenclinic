export const SuccessCodes = {
  RECORD_FETCHED: { code: "GNE_S2000", message: "Operation done successfully", },
  RECORD_CREATED: { code: "GNE_S2001", message: "Operation done successfully", },
  RECORD_UPDATED: { code: "GNE_S2002", message: "Operation done successfully", },
  RECORD_DELETED: { code: "GNE_S2003", message: "Operation done successfully", },
} as const;

export type SuccessCode =
  (typeof SuccessCodes)[keyof typeof SuccessCodes];