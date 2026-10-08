import "dotenv/config";
import "reflect-metadata";
import path from "path";
import { DataSource } from "typeorm";

// export default new DataSource({
//   type: "postgres",
//   host: process.env.DB_HOST,
//   port: Number(process.env.DB_PORT),
//   username: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
//   entities: [path.join(__dirname, "../database/entities/**/*.{ts,js}")],
//   migrations: ["src/migrations/*.ts"],
//   synchronize: false,
// });


//Production
export default new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: [path.join(__dirname, "../database/entities/**/*.{ts,js}")],
  migrations: ["src/migrations/*.ts"],
  synchronize: false,
});