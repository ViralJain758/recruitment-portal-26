import crypto from "node:crypto";
import logger from "../config/logger.js";

// Paths that are polled constantly by uptime monitors / load balancers.
// Logging every single one at "info" would drown out everything else, so
// they're logged at "debug" instead (still visible with LOG_LEVEL=debug).
const LOW_SIGNAL_PATHS = new Set(["/health"]);

export function requestLogger(req, res, next) {
  const requestId = req.headers["x-request-id"]?.toString() || crypto.randomUUID();
  req.requestId = requestId;
  req.log = logger.child({ requestId });
  res.setHeader("X-Request-Id", requestId);

  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const meta = {
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    };

    if (res.statusCode >= 500) {
      req.log.error("API error response", meta);
    } else if (res.statusCode >= 400) {
      req.log.warn("API client error response", meta);
    } else if (LOW_SIGNAL_PATHS.has(req.path)) {
      req.log.debug("Request completed", meta);
    } else {
      req.log.info("Request completed", meta);
    }
  });

  next();
}

export default requestLogger;
