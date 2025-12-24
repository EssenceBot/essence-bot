import { readdir } from "fs/promises";
import path from "path";
import { sql } from "drizzle-orm";
import { getDatabase } from "~/lib/database/index";
import botLog from "~/lib/log";
import toml from "smol-toml";

/**
 * Check if DEVELOPMENT mode is enabled via environment variable
 * Accepts: "1", "true", "yes" (case-insensitive)
 */
function isDevelopmentMode(): boolean {
  const devValue = process.env.DEVELOPMENT?.toLowerCase().trim();
  return devValue === "1" || devValue === "true" || devValue === "yes";
}

export class ModuleMigrationRunner {
  private db = getDatabase();

  async ensureMigrationsTable(): Promise<void> {
    try {
      // Create migrations tracking table if it doesn't exist
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS module_migrations (
          id SERIAL PRIMARY KEY,
          module_name VARCHAR(255) NOT NULL,
          migration_file VARCHAR(255) NOT NULL,
          timestamp VARCHAR(255) NOT NULL,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(module_name, migration_file)
        )
      `);
    } catch (error) {
      botLog("Core", `Failed to create migrations table: ${error}`, "error");
      throw error;
    }
  }

  async getAppliedMigrations(moduleCodeName: string): Promise<string[]> {
    try {
      const result = await this.db.execute(sql`
        SELECT migration_file FROM module_migrations 
        WHERE module_name = ${moduleCodeName}
        ORDER BY timestamp ASC
      `);
      return result.map((row: any) => row.migration_file);
    } catch (error) {
      botLog(
        "Core",
        `Failed to get applied migrations for ${moduleCodeName}: ${error}`,
        "error"
      );
      return [];
    }
  }

  async markMigrationAsApplied(
    moduleCodeName: string,
    migrationFile: string,
    timestamp: string
  ): Promise<void> {
    try {
      await this.db.execute(sql`
        INSERT INTO module_migrations (module_name, migration_file, timestamp) 
        VALUES (${moduleCodeName}, ${migrationFile}, ${timestamp})
        ON CONFLICT (module_name, migration_file) DO NOTHING
      `);
    } catch (error) {
      botLog("Core", `Failed to mark migration as applied: ${error}`, "error");
      throw error;
    }
  }

  async getMigrationFiles(migrationsPath: string): Promise<string[]> {
    try {
      const files = await readdir(migrationsPath);
      return files.filter((file) => file.endsWith(".sql")).sort(); // Ensure migrations run in order
    } catch (error) {
      if (error instanceof Error && error.message.includes("ENOENT")) {
        return []; // No migrations directory
      }
      throw error;
    }
  }

  async runModuleMigrations(
    moduleCodeName: string,
    modulePath: string
  ): Promise<void> {
    const migrationsPath = path.join(modulePath, "migrations");

    try {
      await this.ensureMigrationsTable();

      const migrationFiles = await this.getMigrationFiles(migrationsPath);
      if (migrationFiles.length === 0) {
        botLog("Core", `No migrations found for module ${moduleCodeName}`);
        return;
      }

      const isDevMode = isDevelopmentMode();
      const appliedMigrations = await this.getAppliedMigrations(moduleCodeName);
      
      // In development mode, re-run all migrations
      const pendingMigrations = isDevMode 
        ? migrationFiles 
        : migrationFiles.filter((file) => !appliedMigrations.includes(file));

      if (pendingMigrations.length === 0) {
        botLog(
          "Core",
          `All migrations up to date for module ${moduleCodeName}`
        );
        return;
      }

      if (isDevMode && appliedMigrations.length > 0) {
        botLog(
          "Core",
          `DEVELOPMENT mode enabled - re-running all ${pendingMigrations.length} migrations for module ${moduleCodeName}...`
        );
      } else {
        botLog(
          "Core",
          `Running ${pendingMigrations.length} migrations for module ${moduleCodeName}...`
        );
      }

      for (const migrationFile of pendingMigrations) {
        const migrationPath = path.join(migrationsPath, migrationFile);
        const migrationSql = await Bun.file(migrationPath).text();

        botLog(
          "Core",
          `Applying migration ${migrationFile} for module ${moduleCodeName}`
        );

        try {
          // Run the migration
          await this.db.execute(sql.raw(migrationSql));

          // Extract timestamp from filename (assuming format: YYYY-MM-DD-HH-MM-SS_description.sql)
          const timestamp =
            migrationFile.split("_")[0] || new Date().toISOString();

          // Mark as applied
          await this.markMigrationAsApplied(
            moduleCodeName,
            migrationFile,
            timestamp
          );

          botLog(
            "Core",
            `Successfully applied migration ${migrationFile} for module ${moduleCodeName}`
          );
        } catch (migrationError) {
          botLog(
            "Core",
            `Failed to apply migration ${migrationFile} for module ${moduleCodeName}: ${migrationError}`,
            "error"
          );
          throw migrationError;
        }
      }

      botLog("Core", `Completed migrations for module ${moduleCodeName}`);
    } catch (error) {
      botLog(
        "Core",
        `Failed to run migrations for module ${moduleCodeName}: ${error}`,
        "error"
      );
      throw error;
    }
  }

  async checkModuleRequiresDatabase(modulePath: string): Promise<boolean> {
    try {
      const manifestPath = path.join(modulePath, "manifest.toml");
      const manifestContent = await Bun.file(manifestPath).text();
      const manifest = toml.parse(manifestContent) as any;

      return manifest.database?.requiresDatabase === true;
    } catch (error) {
      return false; // If we can't read the manifest or it doesn't specify, assume no database required
    }
  }
}
