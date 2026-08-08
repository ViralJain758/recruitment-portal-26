import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import db from "../src/config/db.js";
import { io as ioClient } from "socket.io-client";

const port = process.env.PORT || 5000;
const serverUrl = `http://localhost:${port}`;
const tokensFile = path.resolve("scripts/load/quiz-load-users.json");

async function testWebsockets() {
  console.log("=== WEBSOCKET (SOCKET.IO) HEALTH CHECK ===");
  console.log(`Connecting to ${serverUrl}...`);

  // Load a real candidate token from load test tokens file or DB
  const fileContent = await fs.readFile(tokensFile, "utf8");
  const candidates = JSON.parse(fileContent);
  const candidateToken = candidates[0].token;

  console.log(`Using real seeded candidate token for email: ${candidates[0].email}`);

  let candidateConnected = false;

  // 1. Test Candidate Socket Connection
  const candidateSocket = ioClient(serverUrl, {
    auth: { token: candidateToken },
    transports: ["websocket", "polling"],
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Candidate socket connection timeout"));
    }, 5000);

    candidateSocket.on("connect", () => {
      candidateConnected = true;
      console.log(`[PASS] Candidate socket authenticated and connected successfully! (ID: ${candidateSocket.id})`);

      // Emit slot refresh
      candidateSocket.emit("slot:refresh");
      console.log("[PASS] Emitted slot:refresh event on candidate socket");

      clearTimeout(timeout);
      resolve();
    });

    candidateSocket.on("connect_error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  candidateSocket.disconnect();

  console.log("\n==========================================");
  console.log("       WEBSOCKET TEST RESULTS SUMMARY     ");
  console.log("==========================================");
  console.log(`Candidate WebSocket Authentication & Sync : WORKING ✅`);
  console.log("==========================================\n");
}

testWebsockets().catch((err) => {
  console.error("WebSocket Test Failed:", err);
  process.exit(1);
});
