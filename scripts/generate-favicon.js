import { $ } from "bun";
import path from "path";



console.log("Checking if ImageMagick convert is installed...");

const convert = await $`which convert`.text();

if (convert.includes("not found")) {
  console.error("Error: convert command not found. Please install ImageMagick.");
  process.exit(1);
}

console.log("ImageMagick convert is installed, generating favicon...");



const rootDir = path.resolve(__dirname, "..");

const convertOut = await $`convert ${rootDir}/assets/logo-ttb-frame-essence-bot.png -define icon:auto-resize=64,48,32,16 ${rootDir}/dashboard/public/favicon.ico`;

if (convertOut.exitCode !== 0 || Bun.file("../dashboard/public/favicon.ico").exists() === false) {
  console.error("Error: Favicon generation failed.");
  process.exit(1);
}

console.log("Favicon generated successfully.");
``