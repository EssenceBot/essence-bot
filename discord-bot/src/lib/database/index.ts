import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import * as schema from "~/lib/database/schema/index";
import botLog from "~/lib/log";
import { readdir } from "node:fs/promises";
import path from "node:path";

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl?: boolean;
}

let db: ReturnType<typeof drizzle> | null = null;
let connection: ReturnType<typeof postgres> | null = null;

export function isDatabaseEnabled(): boolean {
  return !!(process.env.DB_HOST || process.env.DATABASE_URL);
}

export function getDatabaseConfig(): DatabaseConfig | null {
  if (!isDatabaseEnabled()) {
    return null;
  }

  if (process.env.DATABASE_URL) {
    // Parse DATABASE_URL format: postgres://user:password@host:port/database
    const url = new URL(process.env.DATABASE_URL);
    return {
      host: url.hostname,
      port: parseInt(url.port || "5432"),
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1), // Remove leading slash
      ssl:
        url.searchParams.get("ssl") === "true" ||
        url.searchParams.get("sslmode") === "require",
    };
  }

  return {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432"),
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "essence_bot",
    ssl: process.env.DB_SSL === "true",
  };
}

export async function initializeDatabase(): Promise<boolean> {
  if (!isDatabaseEnabled()) {
    botLog("Core", "Database not configured, skipping database initialization");
    return false;
  }

  const config = getDatabaseConfig()!;

  try {
    botLog("Core", "Connecting to PostgreSQL database...");

    connection = postgres({
      host: config.host,
      port: config.port,
      username: config.user,
      password: config.password,
      database: config.database,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
    });

    db = drizzle(connection, { schema });

    botLog("Core", "Successfully connected to database");
    return true;
  } catch (error) {
    botLog("Core", `Failed to connect to database: ${error}`, "error");
    return false;
  }
}

export async function runModuleMigrations(
  moduleCodeName: string,
  modulePath: string
): Promise<void> {
  if (!db || !connection) {
    botLog(
      "Core",
      "Database not initialized, skipping module migrations",
      "warn"
    );
    return;
  }

  const migrationsPath = path.join(modulePath, "migrations");

  try {
    // Check if module has migrations directory
    const migrationFiles = await readdir(migrationsPath).catch(() => []);

    if (migrationFiles.length === 0) {
      botLog("Core", `No migrations found for module ${moduleCodeName}`);
      return;
    }

    botLog("Core", `Running migrations for module ${moduleCodeName}...`);
    await migrate(db, { migrationsFolder: migrationsPath });
    botLog("Core", `Migrations completed for module ${moduleCodeName}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("ENOENT")) {
      botLog(
        "Core",
        `No migrations directory found for module ${moduleCodeName}`
      );
      return;
    }
    botLog(
      "Core",
      `Failed to run migrations for module ${moduleCodeName}: ${error}`,
      "error"
    );
    throw error;
  }
}

export function getDatabase() {
  if (!db) {
    throw new Error(
      "Database not initialized. Call initializeDatabase() first."
    );
  }
  return db;
}

export function getDatabaseConnection() {
  if (!connection) {
    throw new Error(
      "Database connection not initialized. Call initializeDatabase() first."
    );
  }
  return connection;
}

export async function closeDatabase(): Promise<void> {
  if (connection) {
    await connection.end();
    connection = null;
    db = null;
    botLog("Core", "Database connection closed");
  }
}

// Export schema for modules to use
export { schema, registerModuleSchema } from "~/lib/database/schema/index";
