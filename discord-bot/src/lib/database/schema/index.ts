// Core schema exports
// This file will be expanded when core tables are needed

// Re-export all module schemas that get registered
export const moduleSchemas: Record<string, any> = {};

export function registerModuleSchema(moduleName: string, schema: any) {
  moduleSchemas[moduleName] = schema;
}

// Main schema object that combines all schemas
export const schema = {
  ...moduleSchemas,
};

// Export any core tables here when needed
// export * from "./core";
