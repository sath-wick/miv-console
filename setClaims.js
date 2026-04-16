import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const VALID_ROLES = new Set(["admin", "courier"]);

function exitWithError(message) {
  console.error(message);
  process.exit(1);
}

const [uid, role] = process.argv.slice(2);

if (!uid || !role) {
  exitWithError("Usage: node setClaims.js <UID> <admin|courier>");
}

if (!VALID_ROLES.has(role)) {
  exitWithError("Invalid role. Allowed values: admin, courier.");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const primaryKeyPath = path.resolve(__dirname, "serviceAccountKey.json");
const fallbackKeyPath = path.resolve(__dirname, "miv-serviceKey.json");

const keyPath = fs.existsSync(primaryKeyPath) ? primaryKeyPath : fallbackKeyPath;

if (!fs.existsSync(keyPath)) {
  exitWithError(
    "Service account key file not found. Expected serviceAccountKey.json in project root."
  );
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf8"));
} catch (error) {
  exitWithError(`Failed to parse service account JSON: ${error instanceof Error ? error.message : String(error)}`);
}

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}

try {
  await getAuth().setCustomUserClaims(uid, { role });
  console.log(`Success: custom claim set for UID '${uid}' with role '${role}'.`);
  process.exit(0);
} catch (error) {
  exitWithError(`Failed to set custom claims: ${error instanceof Error ? error.message : String(error)}`);
}
