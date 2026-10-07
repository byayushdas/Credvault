import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const local = path.join(root, ".local");
fs.mkdirSync(local, { recursive: true });
const secretsFile = path.join(local, "database.json");
if (!fs.existsSync(secretsFile))
  fs.writeFileSync(
    secretsFile,
    JSON.stringify(
      {
        admin: crypto.randomBytes(32).toString("hex"),
        app: crypto.randomBytes(32).toString("hex"),
      },
      null,
      2,
    ),
    { mode: 0o600, flag: "wx" },
  );
const secrets = JSON.parse(fs.readFileSync(secretsFile, "utf8"));
const databaseDir = path.join(local, "postgres");
const pg = new EmbeddedPostgres({
  databaseDir,
  user: "postgres",
  password: secrets.admin,
  port: 55432,
  persistent: true,
  authMethod: "scram-sha-256",
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: (msg) => console.error(String(msg)),
});
if (!fs.existsSync(path.join(databaseDir, "PG_VERSION"))) await pg.initialise();
await pg.start();
const client = pg.getPgClient();
await client.connect();
if (
  !(await client.query("SELECT 1 FROM pg_roles WHERE rolname='credvault'"))
    .rowCount
)
  await client.query(
    "CREATE ROLE credvault LOGIN PASSWORD '" + secrets.app + "'",
  );
for (const name of ["credvault", "credvault_test"])
  if (
    !(await client.query("SELECT 1 FROM pg_database WHERE datname=$1", [name]))
      .rowCount
  )
    await client.query("CREATE DATABASE " + name + " OWNER credvault");
await client.end();
console.log(
  "PostgreSQL ready on 127.0.0.1:55432. Persistent data: .local/postgres. Keep this terminal running.",
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await pg.stop();
    process.exit(0);
  });
setInterval(() => {}, 60000);
