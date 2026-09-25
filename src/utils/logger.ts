import { createLogger, format, transports } from "winston";

// The proxy's stdout/stderr are the log file itself (fd handed over at spawn),
// so both roles log to the console; only the format differs.
const isProxyProcess = process.env.LOCADOT_ROLE === "proxy";

const logger = createLogger({
  level: process.env.LOCADOT_LOG_LEVEL || "info",
  format: isProxyProcess
    ? format.combine(
        format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        format.errors({ stack: true }),
        format.printf(
          ({ timestamp, level, message, stack }) =>
            `${timestamp} [${level}]: ${stack || message}`
        )
      )
    : format.combine(
        format.errors({ stack: true }),
        format.printf(({ message, stack }) => `${stack || message}`)
      ),
  transports: [new transports.Console()],
});

export default logger;
