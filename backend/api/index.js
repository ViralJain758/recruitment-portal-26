import app, { initSchemaIfNeeded } from "../server.js";

export default async function handler(req, res) {
  try {
    await initSchemaIfNeeded();
  } catch (err) {
    console.error("Vercel serverless schema initialization error:", err);
  }
  return app(req, res);
}
