import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import pg from "pg";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, "backend/.env"),
  envText = fs.readFileSync(envPath, "utf8");
const config = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((s) => s.includes("=") && !s.startsWith("#"))
    .map((s) => [
      s.slice(0, s.indexOf("=")).trim(),
      s.slice(s.indexOf("=") + 1).trim(),
    ]),
);
const migrationUrl = config.MIGRATION_DATABASE_URL || config.DATABASE_URL;
const parsed = new URL(migrationUrl);
if (
  parsed.hostname !== "127.0.0.1" ||
  parsed.port !== "55432" ||
  parsed.pathname !== "/credvault"
)
  throw new Error(
    "Automatic grants apply only to the bundled local database. For other databases use deploy/roles.sql.",
  );
const secretsFile = path.join(root, ".local/database.json"),
  secrets = JSON.parse(fs.readFileSync(secretsFile, "utf8"));
if (!secrets.runtime) {
  secrets.runtime = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(secretsFile, JSON.stringify(secrets, null, 2), {
    mode: 0o600,
  });
}
const admin = new pg.Client({
  host: "127.0.0.1",
  port: 55432,
  user: "postgres",
  password: secrets.admin,
  database: "credvault",
});
await admin.connect();
if (
  !(
    await admin.query(
      "SELECT 1 FROM pg_roles WHERE rolname='credvault_runtime'",
    )
  ).rowCount
)
  await admin.query(
    "CREATE ROLE credvault_runtime LOGIN PASSWORD '" +
      secrets.runtime +
      "' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT",
  );
await admin.query("GRANT CONNECT ON DATABASE credvault TO credvault_runtime");
await admin.query("GRANT USAGE ON SCHEMA public TO credvault_runtime");
const tables = await admin.query(
  "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'cv_%'",
);
for (const { tablename } of tables.rows) {
  if (!/^cv_[a-z_]+$/.test(tablename)) throw new Error("Unexpected table name");
  await admin.query(
    "GRANT SELECT,INSERT ON TABLE " + tablename + " TO credvault_runtime",
  );
  if (tablename !== "cv_audit")
    await admin.query(
      "GRANT UPDATE,DELETE ON TABLE " + tablename + " TO credvault_runtime",
    );
}
await admin.query(
  "GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO credvault_runtime",
);
await admin.query(
  "REVOKE UPDATE,DELETE,TRUNCATE ON TABLE cv_audit FROM credvault_runtime",
);
await admin.end();
const runtimeUrl = new URL(migrationUrl);
runtimeUrl.username = "credvault_runtime";
runtimeUrl.password = secrets.runtime;
let revised = envText.replace(
  /^DATABASE_URL=.*$/m,
  "DATABASE_URL=" + runtimeUrl.toString(),
);
if (!config.MIGRATION_DATABASE_URL)
  revised += "\nMIGRATION_DATABASE_URL=" + migrationUrl + "\n";
fs.writeFileSync(envPath, revised, { mode: 0o600 });
console.log(
  "Local runtime role configured: audit insert/select only; no table ownership or DDL rights. Encryption key preserved.",
);
