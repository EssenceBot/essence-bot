import chalk, { type ColorName } from "chalk";
import { LogLevel } from "~/types/types";

const defaultColorByLogLevel: Record<LogLevel, ColorName> = {
  [LogLevel.INFO]: "white",
  [LogLevel.WARN]: "yellow",
  [LogLevel.ERROR]: "red",
  [LogLevel.DEBUG]: "green",
};

// Log level hierarchy (lower number = higher priority)
const logLevelPriority: Record<LogLevel, number> = {
  [LogLevel.ERROR]: 0,
  [LogLevel.WARN]: 1,
  [LogLevel.INFO]: 2,
  [LogLevel.DEBUG]: 3,
};

function getConfiguredLogLevel(): LogLevel {
  const envLogLevel = process.env.LOG_LEVEL?.toLowerCase();

  switch (envLogLevel) {
    case "error":
      return LogLevel.ERROR;
    case "warn":
      return LogLevel.WARN;
    case "info":
      return LogLevel.INFO;
    case "debug":
      return LogLevel.DEBUG;
    default:
      return LogLevel.INFO; // Default to INFO if not configured
  }
}

function shouldLog(messageLevel: LogLevel): boolean {
  const configuredLevel = getConfiguredLogLevel();
  return logLevelPriority[messageLevel] <= logLevelPriority[configuredLevel];
}

export default function botLog(
  moduleName: string,
  message: string,
  logLevel?: LogLevel | string,
  messageColor?: ColorName
): void {
  // Parse the log level first
  let level: LogLevel;
  if (typeof logLevel === "string") {
    // Accept both enum values and string literals
    switch (logLevel) {
      case "debug":
        level = LogLevel.DEBUG;
        break;
      case "info":
        level = LogLevel.INFO;
        break;
      case "warn":
        level = LogLevel.WARN;
        break;
      case "error":
        level = LogLevel.ERROR;
        break;
      default:
        level = LogLevel.INFO;
    }
  } else {
    level = logLevel ?? LogLevel.INFO;
  }

  // Check if this log level should be displayed
  if (!shouldLog(level)) {
    return;
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const timeZone = now
    .toLocaleString("en-US", { timeZoneName: "short" })
    .split(" ")
    .pop();
  const timeStamp = `${year}/${month}/${day} ${hours}:${minutes}:${seconds}${timeZone}`;
  const msgColor = messageColor ?? defaultColorByLogLevel[level];
  const formatted = `${chalk.gray(timeStamp)} ${chalk.gray(
    level + ":"
  )} ${chalk.green(`[${moduleName}]`)} ${chalk[msgColor](message)}`;
  switch (level) {
    case LogLevel.ERROR:
      console.error(formatted);
      break;
    case LogLevel.WARN:
      console.warn(formatted);
      break;
    case LogLevel.INFO:
      console.info(formatted);
      break;
    case LogLevel.DEBUG:
      console.debug(formatted);
      break;
    default:
      console.log(formatted);
  }
}
