import appRoot from "app-root-path";
import { readdir } from "node:fs/promises";
import { $ } from "bun";
import JSONC from 'jsonc-simple-parser';
import { loadedModules } from "../index";

type ModuleManifest = {
    name: string;
    fullName: string;
    description: string;
    author: string;
    dependencies?: {
        required: Record<string, string>;
        optional?: Record<string, string>;
    };
};

const modulesDirs = await readdir(`${appRoot}/modules`, { withFileTypes: true })
    .then(dirs => dirs.length ? dirs
    .filter(dirent => dirent
    .isDirectory())
    .map(dirent => `${appRoot}/modules/${dirent.name}`) as string[] : null);

if (await Bun.file(`${appRoot}/config/modules.json`).exists() === false) {
    await Bun.write(`${appRoot}/config/modules.json`, JSON.stringify({"disabledModules": {}, installedModules: {} }, null, 4));
}

const modulesConf = await Bun.file(`${appRoot}/config/modules.json`).json();

export async function initialModuleImport(): Promise<string[]> {
    if (!modulesDirs) {
        console.log("No modules found");
        return [];
    }
    for (const modulePath of modulesDirs) {
        const moduleCodeName = modulePath.split("/").pop() as string;
        if (modulesConf.disabled && modulesConf.disabled.includes(moduleCodeName)) {
            console.log(`Module ${moduleCodeName} is disabled, skipping...`);
            continue;
        }
        try {
            const importResult = await importModule(moduleCodeName, modulePath);
            if (importResult === true) {
                loadedModules.push(moduleCodeName);
            }
        } catch (error) {
            console.error(`Error importing module ${moduleCodeName}.`, error);
        }
    }
    return loadedModules;
}

const requiredFiles = ['index.ts', 'manifest.jsonc', 'package.json'];

async function importModule(moduleCodeName: string, modulePath: string): Promise<boolean>{
    const validationResults = await validateModule(moduleCodeName, modulePath);
    if (validationResults.pass === false) {
        console.error(`Module ${moduleCodeName} is invalid, skipping...`);
        return false;
    }
    const moduleImport = await import(`${modulePath}/index`);
    if (typeof moduleImport.discordBotInit === "function") {
        
        const installedModuleVersion = await Bun.file(`${modulePath}/${requiredFiles[2]}`)
            .text()
            .then(m => JSONC.parse(m).version);
 
        if (!(moduleCodeName in modulesConf.installedModules) || (modulesConf.installedModules[moduleCodeName] != installedModuleVersion)) {
            console.log(`Module ${moduleCodeName} is not installed or version has changed, installing...`);
            await $`bun install`.cwd(modulePath);
        }
        try {
            moduleImport.discordBotInit();
        } catch (error) {
            console.error(`Module ${moduleCodeName} failed to load:`, error);
            return false;
        }
        modulesConf.installedModules[moduleCodeName] = validationResults.moduleVersion;
        await Bun.write(`${appRoot}/config/modules.json`, JSON.stringify(modulesConf, null, 4));
        return true;
    }
    console.error(`Module ${moduleCodeName} is missing export 'discordBotInit' in index file`);
    return false;
    
}

async function validateModule(moduleCodeName: string, modulePath: string): Promise<{ pass: boolean, moduleVersion?: string }> {
    for (const file of requiredFiles) {
        try {
            const filePath = `${modulePath}/${file}`;
            await Bun.file(filePath).exists();
        } catch (error) {
            console.error(`Module ${moduleCodeName} is missing file ${file}`);
            return { pass: false };
        }
    }
    const moduleVersion = await Bun.file(`${modulePath}/${requiredFiles[2]}`).json().then(p => p.version);
    const manifest = Bun.file(`${modulePath}/${requiredFiles[1]}`);
    const manifestData: ModuleManifest = await manifest.text().then(m => JSONC.parse(m));
    if(typeof manifestData.name !== 'string') {
        console.error(`Module ${moduleCodeName} is missing field 'name' or isn't string in ${requiredFiles[1]}`);
        return { pass: false };
    }
    if (typeof manifestData.fullName !== 'string') {
        console.error(`Module ${moduleCodeName} is missing field 'fullName' or isn't string in ${requiredFiles[1]}`);
        return { pass: false };
    }
    if (typeof manifestData.description !== 'string') {
        console.error(`Module ${moduleCodeName} is missing field 'description' or isn't string in ${requiredFiles[1]}`);
        return { pass: false };
    }
    if (typeof manifestData.author !== 'string') {
        console.error(`Module ${moduleCodeName} is missing field 'author' or isn't string in ${requiredFiles[1]}`);
        return { pass: false };
    }
    if (manifestData.dependencies) {
        if (manifestData.dependencies.required) {
            console.error(`Module ${moduleCodeName} have field 'dependencies' present but field 'required' is missing in ${requiredFiles[1]}`);
            return { pass: false };
        } else if (typeof manifestData.dependencies.required !== 'object') {
            console.error(`Module ${moduleCodeName} have field 'dependencies' present but field 'required' isn't an objectn in ${requiredFiles[1]}`);
            return { pass: false };
        }
        if (manifestData.dependencies.optional && typeof manifestData.dependencies.optional !== 'object') {
            console.error(`Module ${moduleCodeName} have field 'dependencies' and field 'optional' present but field 'optional' isn't an object in ${requiredFiles[1]}`);
            return { pass: false };
        }
    }
    return { pass: true, moduleVersion };
}