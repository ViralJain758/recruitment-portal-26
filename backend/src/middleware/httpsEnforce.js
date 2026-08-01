import logger from "../config/logger.js";

// Most platforms (Render, Railway, Fly.io, Heroku, behind an ALB, etc.)
// terminate TLS at a proxy in front of the app and forward plain HTTP
// internally, setting `X-Forwarded-Proto`. With `app.set("trust proxy", 1)`
// in server.js, Express exposes that as `req.secure` / `req.protocol`.
//
// This middleware redirects any lingering plain-HTTP request to HTTPS and
// is a no-op for local development (NODE_ENV !== "production"), so it
// never gets in the way of `http://localhost`.
export function httpsEnforce(req, res, next) {
  if (process.env.NODE_ENV !== "production") {
    return next();
  }

  if (req.secure || req.headers["x-forwarded-proto"] === "https") {
    return next();
  }

  logger.warn("Rejecting insecure HTTP request", {
    path: req.originalUrl,
    ip: req.ip,
  });

  const host = req.headers.host;
  return res.redirect(308, `https://${host}${req.originalUrl}`);
}

export default httpsEnforce;
