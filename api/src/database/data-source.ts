import "reflect-metadata";
import { DataSource } from "typeorm";
import { AuditLog } from "./entities/AuditLog";
import { User } from "./entities/User";
import { Patient } from "./entities/Patient";
import { OPDVisit } from "./entities/OPDVisit";
import { PatientCounter } from "./entities/PatientCounter";
import { OPDVisitCounter } from "./entities/OPDVisitCounter";
// Guard against bundler minification renaming entity classes, which
// corrupts TypeORM's internal dependency graph (targetName = class.name).
// See: TypeORMError "Cyclic dependency: '<letter>'" in production builds.
// function pinName(cls: Function, name: string) {
//   if (cls.name !== name) {
//     Object.defineProperty(cls, "name", { value: name, configurable: true });
//   }
// }

// pinName(User, "User");

// let dataSource: DataSource | null = null;

// export const AppDataSource = async () => {
//   if (dataSource && dataSource.isInitialized) {
//     return dataSource;
//   }

//   dataSource = new DataSource({
//     type: "postgres",
//     host: process.env.DB_HOST,
//     port: Number(process.env.DB_PORT),
//     username: process.env.DB_USER,
//     password: process.env.DB_PASSWORD,
//     database: process.env.DB_NAME,
//     synchronize: false,
//     logging: process.env.NODE_ENV === "development",
//     entities: [
//       AuditLog,
//       User,
//       Patient,
//       PatientCounter,
//       OPDVisit,
//       OPDVisitCounter
//     ],
//   });

//   if (!dataSource.isInitialized) {
//     await dataSource.initialize();
//   }

//   return dataSource;
// };


// //Production
declare global {
  // eslint-disable-next-line no-var
  var __appDataSource: DataSource | undefined;
  // eslint-disable-next-line no-var
  var __appDataSourceInitPromise: Promise<DataSource> | undefined;
}

function buildDataSource() {
  return new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    synchronize: false,
    logging: process.env.NODE_ENV === "development",
    entities: [
     AuditLog,
     User,
     Patient,
     PatientCounter,
     OPDVisit,
     OPDVisitCounter
    ],
  });
}

export const AppDataSource = async () => {
  if (globalThis.__appDataSource?.isInitialized) {
    return globalThis.__appDataSource;
  }

  // Prevent concurrent callers from each starting their own initialize()
  if (!globalThis.__appDataSourceInitPromise) {
    const ds = globalThis.__appDataSource ?? buildDataSource();
    globalThis.__appDataSource = ds;
    globalThis.__appDataSourceInitPromise = ds.initialize();
  }

  await globalThis.__appDataSourceInitPromise;
  return globalThis.__appDataSource!;
};