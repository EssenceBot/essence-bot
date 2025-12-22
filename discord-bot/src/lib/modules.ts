import appRoot from "app-root-path";
import { readdir } from "fs/promises";
import { $ } from "bun";
import toml from "smol-toml";
import { loadedModules } from "~/index";
import { type ModuleManifest, type ModuleDatabaseExports } from "~/types/types";
import botLog from "~/lib/log";
import { isDatabaseEnabled, registerModuleSchema } from "~/lib/database/index";
import { ModuleMigrationRunner } from "~/lib/database/migrations";

function isModuleManifest(obj: any): obj is ModuleManifest {
  return (
    obj &&
    typeof obj === "object" &&
    typeof obj.name === "string" &&
    typeof obj.fullName === "string" &&
    typeof obj.description === "string" &&
    typeof obj.author === "string" &&
    (obj.dependencies === undefined ||
      (typeof obj.dependencies === "object" &&
        obj.dependencies !== null &&
        (!("required" in obj.dependencies) ||
          typeof obj.dependencies.required === "object") &&
        (!("optional" in obj.dependencies) ||
          typeof obj.dependencies.optional === "object")))
  );
}

const modulesDirs = await readdir(`${appRoot}/modules`, {
  withFileTypes: true,
}).then((dirs) =>
  dirs.length
    ? (dirs
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => `${appRoot}/modules/${dirent.name}`) as string[])
    : null
);

if ((await Bun.file(`${appRoot}/config/modules.toml`).exists()) === false) {
  await Bun.write(
    `${appRoot}/config/modules.toml`,
    `disabledModules = []\n\n[installedModules]\n`
  );
}

const rawModulesConf = await Bun.file(`${appRoot}/config/modules.toml`)
  .text()
  .then((m) => toml.parse(m));
const modulesConf = {
  disabledModules: Array.isArray(rawModulesConf.disabledModules)
    ? (rawModulesConf.disabledModules as string[])
    : [],
  installedModules:
    rawModulesConf.installedModules &&
    typeof rawModulesConf.installedModules === "object" &&
    !Array.isArray(rawModulesConf.installedModules)
      ? (rawModulesConf.installedModules as Record<string, string>)
      : {},
};

export async function initialModuleImport(): Promise<string[]> {
  if (!modulesDirs) {
    botLog("Core", "No modules found");
    return [];
  }
  for (const modulePath of modulesDirs) {
    const moduleCodeName = modulePath.split("/").pop() as string;
    if (
      modulesConf.disabledModules &&
      modulesConf.disabledModules.includes(moduleCodeName)
    ) {
      botLog("Core", `Module ${moduleCodeName} is disabled, skipping...`);
      continue;
    }
    try {
      botLog("Core", `Attempting to import module ${moduleCodeName} from ${modulePath}`);
      const importResult = await importModule(moduleCodeName, modulePath);
      if (importResult === true) {
        loadedModules.push(moduleCodeName);
        botLog("Core", `Successfully loaded module ${moduleCodeName}`);
      } else {
        botLog("Core", `Module ${moduleCodeName} import returned false`, "warn");
      }
    } catch (error) {
      botLog("Core", `Error importing module ${moduleCodeName}: ${error instanceof Error ? error.message : String(error)}`, "error");
      if (error instanceof Error && error.stack) {
        botLog("Core", `Stack trace: ${error.stack}`, "error");
      }
    }
  }
  return loadedModules;
}

export async function lateModuleImport(): Promise<string[]> {
  if (!modulesDirs) {
    botLog("Core", "No modules found");
    return [];
  }
  for (const modulePath of modulesDirs) {
    const moduleCodeName = modulePath.split("/").pop() as string;
    if (
      modulesConf.disabledModules &&
      modulesConf.disabledModules.includes(moduleCodeName)
    ) {
      botLog("Core", `Module ${moduleCodeName} is disabled, skipping...`);
      continue;
    }
    try {
      botLog("Core", `Attempting late import for module ${moduleCodeName}`);
      await importModule(moduleCodeName, modulePath, true);
    } catch (error) {
      botLog("Core", `Error in late import for module ${moduleCodeName}: ${error instanceof Error ? error.message : String(error)}`, "error");
      if (error instanceof Error && error.stack) {
        botLog("Core", `Stack trace: ${error.stack}`, "error");
      }
    }
  }
  return loadedModules;
}

const requiredFiles = ["index.ts", "manifest.toml", "package.json"];

async function importModule(
  moduleCodeName: string,
  modulePath: string,
  late?: boolean
): Promise<boolean> {
  botLog("Core", `Validating module ${moduleCodeName}...`);
  const validationResults = await validateModule(moduleCodeName, modulePath);
  if (validationResults.pass === false) {
    botLog("Core", `Module ${moduleCodeName} validation failed, skipping...`, "error");
    return false;
  }
  botLog("Core", `Module ${moduleCodeName} validation passed (version: ${validationResults.moduleVersion})`);

  // Check if module needs installation BEFORE importing
  const installedModuleVersion = validationResults.moduleVersion;
  const shouldInstall =
    !(moduleCodeName in modulesConf.installedModules) ||
    modulesConf.installedModules[moduleCodeName] != installedModuleVersion;

  if (shouldInstall) {
    botLog(
      "Core",
      `Module ${moduleCodeName} is not installed or version has changed, installing dependencies...`
    );
    await $`bun install`.cwd(modulePath);
    botLog("Core", `Dependencies installed for module ${moduleCodeName}`);

    // Handle database operations if database is enabled and module requires it
    if (isDatabaseEnabled()) {
      const migrationRunner = new ModuleMigrationRunner();
      const requiresDb = await migrationRunner.checkModuleRequiresDatabase(
        modulePath
      );

      if (requiresDb) {
        botLog(
          "Core",
          `Module ${moduleCodeName} requires database, running migrations...`
        );
        try {
          await migrationRunner.runModuleMigrations(
            moduleCodeName,
            modulePath
          );
        } catch (error) {
          botLog(
            "Core",
            `Failed to run database migrations for module ${moduleCodeName}: ${error}`,
            "error"
          );
          return false;
        }
      }
    }
  }

  // Import the module AFTER dependencies are installed
  botLog("Core", `Importing module code for ${moduleCodeName}...`);
  const moduleImport = await import(`${modulePath}/index`);
  
  if (typeof moduleImport.discordBotInit === "function") {
    if (!late) {
      try {
        botLog("Core", `Calling discordBotInit for module ${moduleCodeName}...`);
        await moduleImport.discordBotInit();

        // Register module schema if provided
        if (isDatabaseEnabled() && moduleImport.database) {
          const dbExports = moduleImport.database as ModuleDatabaseExports;
          if (dbExports.schema) {
            botLog(
              "Core",
              `Registering database schema for module ${moduleCodeName}`
            );
            registerModuleSchema(moduleCodeName, dbExports.schema);
          }
        }
      } catch (error) {
        botLog("Core", `Module ${moduleCodeName} discordBotInit failed: ${error instanceof Error ? error.message : String(error)}`, "error");
        if (error instanceof Error && error.stack) {
          botLog("Core", `Stack trace: ${error.stack}`, "error");
        }
        return false;
      }
    } else {
      if (typeof moduleImport.lateDiscordBotInit === "function") {
        try {
          botLog("Core", `Calling lateDiscordBotInit for module ${moduleCodeName}...`);
          await moduleImport.lateDiscordBotInit();
          return false;
        } catch (error) {
          botLog("Core", `Module ${moduleCodeName} lateDiscordBotInit failed: ${error instanceof Error ? error.message : String(error)}`, "error");
          if (error instanceof Error && error.stack) {
            botLog("Core", `Stack trace: ${error.stack}`, "error");
          }
          return false;
        }
      }
    }

    modulesConf.installedModules[moduleCodeName] =
      validationResults.moduleVersion ?? "";
    // Write TOML config back
    const tomlString = [
      `disabledModules = [${modulesConf.disabledModules
        .map((m) => `"${m}"`)
        .join(", ")}]`,
      "",
      `[installedModules]`,
      ...Object.entries(modulesConf.installedModules).map(
        ([k, v]) => `"${k}" = "${v}"`
      ),
    ].join("\n");
    await Bun.write(`${appRoot}/config/modules.toml`, tomlString);
    return true;
  }
  botLog(
    "Core",
    `Module ${moduleCodeName} is missing export 'discordBotInit' in index file`,
    "error"
  );
  return false;
}

async function validateModule(
  moduleCodeName: string,
  modulePath: string
): Promise<{ pass: boolean; moduleVersion?: string }> {
  for (const file of requiredFiles) {
    const filePath = `${modulePath}/${file}`;
    const fileExists = await Bun.file(filePath).exists();
    if (!fileExists) {
      botLog(
        "Core",
        `Module ${moduleCodeName} is missing required file: ${file}`,
        "error"
      );
      return { pass: false };
    }
  }
  const moduleVersion = await Bun.file(`${modulePath}/${requiredFiles[2]}`)
    .json()
    .then((p) => p.version);
  const manifest = Bun.file(`${modulePath}/${requiredFiles[1]}`);
  const manifestData = await manifest.text().then((m) => toml.parse(m));
  if (!isModuleManifest(manifestData)) {
    botLog(
      "Core",
      `Module ${moduleCodeName} manifest is invalid or missing required fields in ${requiredFiles[1]}`,
      "error"
    );
    return { pass: false };
  }
  return { pass: true, moduleVersion };
}