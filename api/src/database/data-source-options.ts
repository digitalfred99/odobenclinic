import "reflect-metadata";
import type { DataSourceOptions } from "typeorm";

import { AuditLog } from "./entities/AuditLog";
import { User } from "./entities/User";
import { Patient } from "./entities/Patient";
import { OPDVisit } from "./entities/OPDVisit";
import { PatientCounter } from "./entities/PatientCounter";

const namedEntities = {
  AuditLog,
  User,
  Patient,
  PatientCounter,
  OPDVisit,
} as const;

// Pin class names so minification can't rename them
// (prevents TypeORMError "Cyclic dependency: '<letter>'").
for (const [name, cls] of Object.entries(namedEntities)) {
  if (cls.name !== name) {
    Object.defineProperty(cls, "name", { value: name, configurable: true });
  }
}

export const entities = Object.values(namedEntities);

export function buildOptions(): DataSourceOptions {
  const base = {
    type: "postgres" as const,
    synchronize: false,
    logging: process.env.NODE_ENV === "development",
    entities,
  };

  // Production / hosted: single connection string
  if (process.env.DATABASE_URL) {
    return {
      ...base,
      url: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    };
  }

  // Local: individual vars
  return {
    ...base,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };
}