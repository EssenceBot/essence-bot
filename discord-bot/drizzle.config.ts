import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "src/lib/database/schema/index.ts",
  out: "src/lib/database/migrations",
  dialect: "postgresql",
  dbCredentials: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432"),
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "essence_bot",
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  },
  verbose: true,
  strict: true,
});
