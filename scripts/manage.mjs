import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  backend = path.join(root, "backend");
const windows = process.platform === "win32",
  python = path.join(
    root,
    ".venv",
    windows ? "Scripts/python.exe" : "bin/python",
  );
const mode = process.argv[2] || "dev";
const run = (command, args, cwd = root) => {
  const r = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    windowsHide: true,
  });
  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status || 1);
};
if (mode === "setup") {
  if (!fs.existsSync(python))
    run(process.env.CREDVAULT_PYTHON || (windows ? "py" : "python3"), [
      "-m",
      "venv",
      path.join(root, ".venv"),
    ]);
  run(python, [
    "-m",
    "pip",
    "install",
    "-r",
    path.join(backend, "requirements.txt"),
  ]);
  if (!fs.existsSync(path.join(backend, ".env")))
    fs.writeFileSync(
      path.join(backend, ".env"),
      "DATABASE_URL=postgresql+psycopg://postgres:YOUR_PASSWORD@127.0.0.1:5432/postgres\nAES_MASTER_KEY=" +
        crypto.randomBytes(32).toString("base64") +
        "\nENVIRONMENT=development\nAPP_ORIGIN=http://localhost:5173\nSECURE_COOKIES=false\n",
      { mode: 0o600, flag: "wx" },
    );
  console.log(
    "Configuration preserved. Next: edit backend/.env, then npm run migrate and npm run seed.",
  );
} else if (mode === "migrate") {
  run(python, ["-m", "alembic", "upgrade", "head"], backend);
} else if (mode === "seed") {
  if (process.env.ALLOW_DEMO_SEED === 'true') {
    run(python, ["-m", "scripts.seed_demo"], backend);
  } else {
    console.error("Demo seeding is disabled. Set ALLOW_DEMO_SEED=true to seed demo data.");
    process.exit(1);
  }
} else if (mode === "reset") run(python, ["-m", "scripts.reset_demo"], backend);
else if (mode === "test") run(python, ["-m", "pytest", "tests", "-q"], backend);
else if (mode === "audit")
  run(python, ["-m", "scripts.admin", "audit"], backend);
else if (mode === "dev") {
  const children = [
    spawn(
      python,
      [
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        "8000",
        "--no-access-log",
      ],
      { cwd: backend, stdio: "inherit", windowsHide: true },
    ),
    spawn(
      process.execPath,
      [
        path.join(root, "frontend/node_modules/vite/bin/vite.js"),
        "--host",
        "127.0.0.1",
      ],
      { cwd: path.join(root, "frontend"), stdio: "inherit", windowsHide: true },
    ),
  ];
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    for (const c of children) {
      if (c.exitCode !== null || c.signalCode !== null) continue;
      if (windows)
        spawnSync("taskkill", ["/pid", String(c.pid), "/t", "/f"], {
          windowsHide: true,
          stdio: "ignore",
        });
      else c.kill();
    }
  };
  for (const s of ["SIGINT", "SIGTERM"])
    process.on(s, () => {
      stop();
      process.exit(0);
    });
  children.forEach((c) =>
    c.on("exit", (code) => {
      stop();
      process.exit(code || 0);
    }),
  );
} else throw new Error("Unknown command " + mode);
