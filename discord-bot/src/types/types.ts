export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

export type ModuleManifest = {
  name: string;
  fullName: string;
  description: string;
  author: string;
  dependencies?: {
    required: Record<string, string>;
    optional?: Record<string, string>;
  };
  database?: {
    requiresDatabase: boolean;
    schemaFiles?: string[];
    migrationDir?: string;
  };
};

export type DatabaseSchema = {
  [tableName: string]: any; // Drizzle table definition
};

export interface ModuleDatabaseExports {
  schema?: DatabaseSchema;
  migrationDir?: string;
}
