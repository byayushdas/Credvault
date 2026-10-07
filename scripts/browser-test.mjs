import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import pg from "pg";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  backend = path.join(root, "backend");
const python = path.join(
  root,
  ".venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
);
const config = Object.fromEntries(
  fs
    .readFileSync(path.join(backend, ".env"), "utf8")
    .split(/\r?\n/)
    .filter((s) => s.includes("=") && !s.startsWith("#"))
    .map((s) => [
      s.slice(0, s.indexOf("=")).trim(),
      s.slice(s.indexOf("=") + 1).trim(),
    ]),
);
const schema = "cv_browser_" + crypto.randomUUID().replaceAll("-", "");
const admin = new pg.Client({
  connectionString: (
    config.MIGRATION_DATABASE_URL || config.DATABASE_URL
  ).replace("postgresql+psycopg:", "postgresql:"),
});
await admin.connect();
await admin.query("CREATE SCHEMA " + schema);
const testUrl = new URL(config.MIGRATION_DATABASE_URL || config.DATABASE_URL);
testUrl.searchParams.set("options", "-csearch_path=" + schema);
const env = {
  ...process.env,
  ...config,
  DATABASE_URL: testUrl.toString(),
  MIGRATION_DATABASE_URL: testUrl.toString(),
  APP_ORIGIN: "http://localhost:5174",
  STORAGE_PATH: path.join(root, ".local", schema, "files"),
  MAILBOX_PATH: path.join(root, ".local", schema, "mail"),
  CREDVAULT_API_URL: "http://127.0.0.1:8001",
};
const output = path.join(root, "test-results");
fs.mkdirSync(output, { recursive: true });
console.log("Browser suite started in isolated PostgreSQL schema " + schema);
const children = [];
let browser;
let restarting = false;
const errors = [],
  failures = [],
  restartFailures = [],
  checks = [];
function run(args) {
  const r = spawnSync(python, args, {
    cwd: backend,
    env,
    encoding: "utf8",
    windowsHide: true,
  });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
}
function start(command, args, cwd) {
  const c = spawn(command, args, {
    cwd,
    env,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  c.stdout.on("data", (d) => (logs += d));
  c.stderr.on("data", (d) => (logs += d));
  c.logs = () => logs;
  children.push(c);
  return c;
}
async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  if (process.platform === "win32") {
    const result = spawnSync(
      "taskkill",
      ["/pid", String(child.pid), "/t", "/f"],
      { windowsHide: true, encoding: "utf8" },
    );
    if (result.status !== 0)
      throw new Error(
        "Cannot stop test process " + child.pid + ": " + result.stderr,
      );
  } else child.kill("SIGTERM");
  await Promise.race([
    exited,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Test process did not exit")), 10000),
    ),
  ]);
}
async function wait(url) {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(
    "Server did not start: " + children.map((c) => c.logs()).join("\n"),
  );
}
try {
  run(["-m", "alembic", "upgrade", "head"]);
  run(["-m", "scripts.seed_demo"]);
  const password = JSON.parse(
    fs.readFileSync(path.join(backend, "demo.credentials.json"), "utf8"),
  ).password;
  let server = start(
    python,
    [
      "-m",
      "uvicorn",
      "app.main:app",
      "--host",
      "127.0.0.1",
      "--port",
      "8001",
      "--no-access-log",
    ],
    backend,
  );
  start(
    process.execPath,
    [
      path.join(root, "frontend/node_modules/vite/bin/vite.js"),
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      "5174",
    ],
    path.join(root, "frontend"),
  );
  await wait("http://127.0.0.1:8001/health");
  await wait("http://127.0.0.1:5174/");
  const launch = { headless: true };
  if (process.env.CREDVAULT_BROWSER)
    launch.executablePath = process.env.CREDVAULT_BROWSER;
  else if (process.platform === "win32")
    launch.executablePath =
      "C:/Program Files/Google/Chrome/Application/chrome.exe";
  browser = await chromium.launch(launch);
  if (process.argv.includes("--onboarding-only")) {
    for (const role of ["ISSUER", "VERIFIER"]) {
      const context = await browser.newContext({
        baseURL: "http://localhost:5174",
        viewport: { width: 390, height: 900 },
      });
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("/login");
      await expect(
        page.getByRole("link", { name: "Create account", exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: path.join(output, "three-role-login.png"),
        fullPage: true,
      });
      await page
        .getByRole("link", {
          name: "Create account",
          exact: true,
        })
        .click();
      await page.getByLabel("Account role").selectOption(role);
      await expect(page.getByLabel("Account role")).toHaveValue(role);
      await page
        .getByLabel("Organisation name")
        .fill("Browser " + role + " Institution");
      await page.getByLabel("Full name").fill("Browser Registrar");
      const email = role.toLowerCase() + "@onboarding.demo.test";
      await page.getByLabel("Email", { exact: true }).fill(email);
      await page
        .getByLabel("Password", { exact: true })
        .fill("Browser-onboarding-password-2026");
      await page
        .getByRole("button", { name: "Create account", exact: true })
        .click();
      await expect(
        page.getByText(
          role[0] + role.slice(1).toLowerCase() + " account created.",
          { exact: false },
        ),
      ).toBeVisible();
      await page.getByLabel("Email", { exact: true }).fill(email);
      await page
        .getByLabel("Password", { exact: true })
        .fill("Browser-onboarding-password-2026");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page.getByRole("alert")).toContainText(
        "awaiting administrator approval",
      );
      run([
        "-m",
        "scripts.admin",
        "approve",
        "--email",
        email,
        "--role",
        role,
        "--organization",
        "Browser " + role + " Institution",
      ]);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Dashboard", exact: true }),
      ).toBeVisible();
      await expect(page).toHaveURL(
        "http://localhost:5174/" + role.toLowerCase() + "/dashboard",
      );
      await context.close();
      checks.push(
        role +
          " signup, pending approval, local administrator approval and correct portal",
      );
    }
    expect(errors).toEqual([]);
    fs.writeFileSync(
      path.join(output, "onboarding-report.json"),
      JSON.stringify({ passed: true, checks, errors }, null, 2),
    );
    console.log(JSON.stringify({ passed: true, checks }, null, 2));
  } else {
    async function account(email) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        baseURL: "http://localhost:5174",
      });
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("response", (r) => {
        if (r.url().includes("/api/") && r.status() >= 500)
          (restarting ? restartFailures : failures).push(
            r.status() + " " + r.url(),
          );
      });
      await page.goto("/login");
      await page.getByLabel("Email", { exact: true }).fill(email);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Dashboard", exact: true }),
      ).toBeVisible();
      return { page, context };
    }
    const owner = await account("owner.a@demo.test"),
      issuer = await account("issuer@demo.test"),
      verifier = await account("verifier.a@demo.test");
    const op = owner.page,
      ip = issuer.page,
      vp = verifier.page;
    const ownerId = (
      await (await owner.context.request.get("/api/v1/auth/me")).json()
    ).id;
    const ownerB = await account("owner.b@demo.test"),
      verifierB = await account("verifier.b@demo.test");
    // Keep each role on its page: assertions below must pass without navigation,
    // reload, focus events or the 15-second fallback interval.
    await op.goto("/owner/documents");
    await expect(
      op.getByText("Live updates connected", { exact: false }),
    ).toBeVisible();
    await owner.context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await ownerB.page.evaluate((ownerId) => {
      window.liveEvents = [];
      window.liveProbe = new EventSource("/api/v1/events?user_id=" + ownerId);
      window.liveProbe.addEventListener("change", (event) =>
        window.liveEvents.push(JSON.parse(event.data)),
      );
    }, ownerId);
    await verifierB.page.evaluate(() => {
      window.liveEvents = [];
      window.liveProbe = new EventSource("/api/v1/events");
      window.liveProbe.addEventListener("change", (event) =>
        window.liveEvents.push(JSON.parse(event.data)),
      );
    });
    await expect
      .poll(() => ownerB.page.evaluate(() => window.liveEvents.length))
      .toBe(1);
    await expect
      .poll(() => verifierB.page.evaluate(() => window.liveEvents.length))
      .toBe(1);
    await ip.goto("/issuer/issue");
    await ip.getByLabel("Owner vault ID").fill(ownerId);
    await ip
      .getByLabel("Credential type", { exact: true })
      .selectOption("SEMESTER_MARKSHEET");
    await ip
      .getByLabel("Title", { exact: true })
      .fill("Live Semester Marksheet");
    for (const [field, value] of [
      ["Course", "Live Computer Science"],
      ["Semester", "6"],
      ["CGPA", "8.7"],
      ["Roll number", "PRIVATE-LIVE-ROLL"],
    ])
      await ip.getByLabel(field, { exact: true }).fill(value);
    await ip.getByRole("button", { name: "Review credential" }).click();
    await expect(ip.getByText(/Confirmed active owner vault/)).toBeVisible();
    await ip.getByRole("button", { name: "Confirm and issue" }).click();
    await expect(
      ip.getByRole("heading", { name: "Live Semester Marksheet", exact: true }),
    ).toBeVisible();
    const liveDoc = ip.url().split("/").pop();
    await expect(
      op.getByRole("row").filter({ hasText: "Live Semester Marksheet" }),
    ).toBeVisible({ timeout: 8000 });
    const liveOwner = await (
      await owner.context.request.get("/api/v1/auth/me")
    ).json();
    const liveVerifier = await (
      await verifier.context.request.get("/api/v1/auth/me")
    ).json();
    for (const [field, action] of [
      ["course", "AUTO_APPROVE"],
      ["semester", "AUTO_APPROVE"],
      ["cgpa", "ASK"],
      ["rollNumber", "DENY"],
    ]) {
      const r = await owner.context.request.post("/api/v1/consent/rules", {
        headers: { "X-CSRF-Token": liveOwner.csrf },
        data: {
          credential_id: liveDoc,
          verifier_id: liveVerifier.organization.id,
          field,
          action,
        },
      });
      expect(r.status()).toBe(201);
    }
    await op.goto("/owner/requests");
    await vp.goto("/verifier/history");
    await expect(
      op.getByText("Live updates connected", { exact: false }),
    ).toBeVisible();
    const submitted = await verifier.context.request.post(
      "/api/v1/verification/requests",
      {
        headers: {
          "X-CSRF-Token": liveVerifier.csrf,
          "Idempotency-Key": crypto.randomUUID(),
        },
        data: {
          owner_id: ownerId,
          credential_id: liveDoc,
          fields: ["course", "semester", "cgpa", "rollNumber"],
          purpose: "Live marksheet acceptance scenario",
          lifetime_hours: 24,
        },
      },
    );
    expect(submitted.status()).toBe(201);
    const liveRequest = await submitted.json();
    await expect(
      op
        .getByRole("row")
        .filter({ hasText: "Live marksheet acceptance scenario" }),
    ).toBeVisible({ timeout: 8000 });
    await vp.goto("/verifier/requests/" + liveRequest.id);
    await expect(vp.locator(".section-head .badge")).toHaveText("Pending");
    await op.goto("/owner/requests/" + liveRequest.id);
    await op.getByLabel("Decision for Cgpa").selectOption("APPROVED");
    await op.getByRole("button", { name: "Review decisions" }).click();
    await op.getByRole("button", { name: "Confirm decisions" }).click();
    await expect(
      vp.getByRole("button", { name: "View result", exact: true }),
    ).toBeVisible({ timeout: 8000 });
    await vp.getByRole("button", { name: "View result", exact: true }).click();
    await expect(
      vp.getByText(
        "Every disclosed claim verified independently in this browser.",
      ),
    ).toBeVisible();
    const liveResult = await (
      await verifier.context.request.get(
        "/api/v1/verification/requests/" + liveRequest.id + "/result",
      )
    ).json();
    expect(liveResult.claims.map((c) => c.field).sort()).toEqual([
      "cgpa",
      "course",
      "semester",
    ]);
    expect(JSON.stringify(liveResult)).not.toContain("PRIVATE-LIVE-ROLL");
    await verifier.context.setOffline(true);
    const issuerMe = await (
      await issuer.context.request.get("/api/v1/auth/me")
    ).json();
    expect(
      (
        await issuer.context.request.post(
          "/api/v1/issuer/documents/" + liveDoc + "/revoke",
          {
            headers: { "X-CSRF-Token": issuerMe.csrf },
            data: { reason: "Live reconnect revocation test" },
          },
        )
      ).status(),
    ).toBe(200);
    await verifier.context.setOffline(false);
    await expect(vp.getByText("Revoked", { exact: true })).toBeVisible({
      timeout: 10000,
    });
    await expect(vp.locator(".claim-list")).not.toBeVisible();
    expect(
      (
        await verifier.context.request.get(
          "/api/v1/verification/requests/" + liveRequest.id + "/result",
        )
      ).status(),
    ).toBe(409);
    expect(await ownerB.page.evaluate(() => window.liveEvents.length)).toBe(1);
    expect(await verifierB.page.evaluate(() => window.liveEvents.length)).toBe(
      1,
    );
    expect(
      await ownerB.page.evaluate(() => Object.keys(window.liveEvents[0])),
    ).toEqual(["revision"]);
    await ownerB.page.evaluate(() => window.liveProbe.close());
    await verifierB.page.evaluate(() => window.liveProbe.close());
    await op.goto("/owner/dashboard");
    await op.getByRole("button", { name: "Copy Vault ID" }).click();
    await expect(
      op.getByText("Vault ID copied", { exact: true }),
    ).toBeVisible();
    expect(await op.evaluate(() => navigator.clipboard.readText())).toBe(
      ownerId,
    );
    checks.push(
      "Live marksheet issuance, owner delivery/request, verifier decision, reconnect/revocation, isolated SSE cursors and Copy Vault ID",
    );
    await ip
      .getByRole("link", { name: "Issue Credential", exact: true })
      .click();
    await ip.getByLabel("Owner vault ID").fill(ownerId);
    await ip
      .getByLabel("Title", { exact: true })
      .fill("Browser Demo Education");
    await ip.getByLabel("Credential type", { exact: true }).selectOption("DEGREE");
    for (const [field, value] of [
      ["Degree", "Browser Demo B.Tech"],
      ["University ID", "DEMO-UNI-BROWSER"],
      ["CGPA", "8.8"],
      ["Roll number", "DO-NOT-DISCLOSE-BROWSER-ROLL"],
    ])
      await ip.getByLabel(field, { exact: true }).fill(value);
    await ip.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(ip.getByText("Encrypted draft saved.")).toBeVisible();
    await ip.getByRole("button", { name: "Edit draft", exact: true }).click();
    await expect(ip.getByLabel("Title", { exact: true })).toHaveValue(
      "Browser Demo Education",
    );
    await ip.getByRole("button", { name: "Review credential" }).click();
    await ip.getByRole("button", { name: "Back to edit" }).click();
    await expect(ip.getByLabel("Title", { exact: true })).toHaveValue(
      "Browser Demo Education",
    );
    await ip.getByRole("button", { name: "Review credential" }).click();
    await ip.getByRole("button", { name: "Confirm and issue" }).click();
    await expect(
      ip.getByRole("heading", { name: "Browser Demo Education" }),
    ).toBeVisible();
    const docId = ip.url().split("/").pop();
    checks.push("Issuer draft, review/back, issuance and owner delivery");
    await op.goto("/owner/documents/" + docId);
    await expect(op.getByText("Valid Ed25519 signature")).toBeVisible();
    await expect(
      op.getByText("Browser Demo B.Tech", { exact: true }),
    ).toBeVisible();
    const exportedPackage = op.waitForEvent("download");
    await op.getByRole("button", { name: "Export signed package" }).click();
    expect((await exportedPackage).suggestedFilename()).toBe(
      "credential-package.json",
    );
    await op.getByRole("link", { name: "Consent Rules", exact: true }).click();
    for (const [field, action] of [
      ["degree", "AUTO_APPROVE"],
      ["universityId", "AUTO_APPROVE"],
      ["cgpa", "ASK"],
      ["rollNumber", "DENY"],
    ]) {
      await op
        .getByRole("button", { name: "Create rule", exact: true })
        .click();
      const dialog = op.getByRole("dialog");
      await dialog
        .getByLabel("Verifier", { exact: true })
        .selectOption({ label: "ABC Technologies (Demo)" });
      await dialog.getByLabel("Credential document").selectOption(docId);
      await dialog.getByLabel("Field", { exact: true }).selectOption(field);
      await dialog.getByLabel("Consent action").selectOption(action);
      await dialog.getByRole("button", { name: "Save rule" }).click();
      await expect(dialog).not.toBeVisible();
    }
    await vp
      .getByRole("link", { name: "New Verification", exact: true })
      .click();
    await vp.getByLabel("Owner vault ID").fill(ownerId);
    await vp.getByRole("button", { name: "Next", exact: true }).click();
    await vp.getByLabel("Credential type", { exact: true }).selectOption("DEGREE");
    await vp.getByRole("button", { name: "Find eligible credentials" }).click();
    await vp.getByLabel("Select credential reference").selectOption(docId);
    await vp.getByRole("button", { name: "Next", exact: true }).click();
    await expect(
      vp.getByRole("button", { name: "Next", exact: true }),
    ).toBeDisabled();
    for (const f of ["Degree", "University ID", "CGPA", "Roll number"])
      await vp.getByLabel(f, { exact: true }).check();
    await vp
      .getByLabel("Purpose", { exact: true })
      .fill("Classroom education verification");
    await vp.getByRole("button", { name: "Next", exact: true }).click();
    await vp.getByRole("button", { name: "Back", exact: true }).click();
    await expect(vp.getByLabel("Purpose", { exact: true })).toHaveValue(
      "Classroom education verification",
    );
    await vp.getByRole("button", { name: "Next", exact: true }).click();
    await vp
      .getByRole("button", { name: "Submit request", exact: true })
      .click();
    await expect(
      vp.getByRole("heading", { name: "Verification request", exact: true }),
    ).toBeVisible();
    const requestId = vp.url().split("/").pop();
    checks.push(
      "Four-step wizard, exact discovery, validation, back preservation and real submission",
    );
    await op.goto("/owner/requests/" + requestId);
    await op.getByLabel("Decision for Cgpa").selectOption("APPROVED");
    await op.getByRole("button", { name: "Review decisions" }).click();
    await op.getByRole("button", { name: "Confirm decisions" }).click();
    await expect(op.getByRole("dialog")).not.toBeVisible();
    await vp.reload();
    await vp.getByRole("button", { name: "View result", exact: true }).click();
    await expect(
      vp.getByText(
        "Every disclosed claim verified independently in this browser.",
      ),
    ).toBeVisible();
    await expect(vp.locator(".claim-list")).not.toContainText(
      "DO-NOT-DISCLOSE",
    );
    const resultResponse = await verifier.context.request.get(
      "/api/v1/verification/requests/" + requestId + "/result",
    );
    const result = await resultResponse.json();
    expect(result.claims.map((c) => c.field).sort()).toEqual([
      "cgpa",
      "degree",
      "universityId",
    ]);
    expect(JSON.stringify(result)).not.toContain(
      "DO-NOT-DISCLOSE-BROWSER-ROLL",
    );
    await vp.getByRole("button", { name: "Show JSON" }).click();
    await expect(vp.locator("pre")).not.toContainText("rollNumber");
    const download = vp.waitForEvent("download");
    await vp.getByRole("button", { name: "Download result JSON" }).click();
    const downloaded = await download;
    expect(downloaded.suggestedFilename()).toBe("verification-result.json");
    const downloadedText = fs.readFileSync(await downloaded.path(), "utf8");
    expect(downloadedText).not.toContain("rollNumber");
    expect(downloadedText).not.toContain("DO-NOT-DISCLOSE-BROWSER-ROLL");
    expect(
      JSON.parse(downloadedText)
        .claims.map((c) => c.field)
        .sort(),
    ).toEqual(["cgpa", "degree", "universityId"]);
    checks.push(
      "Partial consent, exactly three disclosed values, independently verified browser proofs and JSON download",
    );
    expect(
      (await ownerB.context.request.get("/api/v1/documents/" + docId)).status(),
    ).toBe(404);
    expect(
      (
        await verifierB.context.request.get(
          "/api/v1/verification/requests/" + requestId + "/result",
        )
      ).status(),
    ).toBe(404);
    await ownerB.page.goto("/owner/documents/" + docId);
    await expect(ownerB.page.getByRole("alert")).toContainText("unavailable");
    checks.push("Owner B and Verifier B isolation through UI and direct API");
    await op.goto("/owner/documents");
    await op.getByRole("button", { name: "Import document" }).click();
    await op.getByLabel("Document title").fill("Personal unsigned image");
    const imagePath = path.join(output, "personal-fixture.png");
    run([
      "-c",
      'from PIL import Image; import sys; Image.new("RGB", (20,20), (11,37,69)).save(sys.argv[1])',
      imagePath,
    ]);
    const png = fs.readFileSync(imagePath);
    await op.getByLabel("File", { exact: true }).setInputFiles({
      name: "personal.png",
      mimeType: "image/png",
      buffer: png,
    });
    await op.getByRole("button", { name: "Import", exact: true }).click();
    await expect(op.getByRole("dialog")).not.toBeVisible();
    const row = op
      .getByRole("row")
      .filter({ hasText: "Personal unsigned image" });
    await expect(row).toContainText("Unverified");
    await row.getByRole("link", { name: "View", exact: true }).click();
    await op.getByRole("button", { name: "Preview attachment" }).click();
    await expect(op.getByAltText("Credential attachment")).toBeVisible();
    await op.getByRole("button", { name: "Close dialog" }).click();
    const personalDownload = op.waitForEvent("download");
    await op.getByRole("button", { name: "Download", exact: true }).click();
    await personalDownload;
    await op.getByRole("button", { name: "Archive personal upload" }).click();
    await expect(op.getByText("Archived", { exact: true })).toBeVisible();
    checks.push(
      "Unsigned import stays unverified, authenticated preview/download, archive",
    );
    const signedPackage = await (
      await owner.context.request.get("/api/v1/documents/" + docId + "/package")
    ).json();
    await op.goto("/owner/documents");
    await op.getByRole("button", { name: "Import document" }).click();
    await op.getByLabel("Import type").selectOption("signed");
    await op.getByLabel("File", { exact: true }).setInputFiles({
      name: "credential.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(signedPackage)),
    });
    await op.getByRole("button", { name: "Import", exact: true }).click();
    await expect(op.getByRole("dialog")).not.toBeVisible();
    await expect(op.getByText("Signed package validated.")).toBeVisible();
    checks.push(
      "Signed package import validates the existing issuer record and owner binding",
    );
    async function submitApi(fields, credentialId = docId) {
      const me = await (
        await verifier.context.request.get("/api/v1/auth/me")
      ).json();
      const response = await verifier.context.request.post(
        "/api/v1/verification/requests",
        {
          headers: {
            "X-CSRF-Token": me.csrf,
            "Idempotency-Key": crypto.randomUUID(),
          },
          data: {
            owner_id: ownerId,
            credential_id: credentialId,
            fields,
            purpose: "Additional classroom control validation",
            lifetime_hours: 24,
          },
        },
      );
      expect(response.status()).toBe(201);
      return response.json();
    }
    const denied = await submitApi(["cgpa"]);
    await op.goto("/owner/requests/" + denied.id);
    await op.getByRole("button", { name: "Deny pending fields" }).click();
    await op.getByRole("button", { name: "Confirm decisions" }).click();
    await expect(op.getByRole("dialog")).not.toBeVisible();
    await vp.goto("/verifier/requests/" + denied.id);
    await expect(
      vp.getByRole("button", { name: "View result", exact: true }),
    ).not.toBeVisible();
    await expect(vp.locator(".section-head .badge")).toHaveText("Denied");
    const cancelled = await submitApi(["cgpa"]);
    await vp.goto("/verifier/requests/" + cancelled.id);
    await vp.getByRole("button", { name: "Cancel request" }).click();
    await vp.getByRole("button", { name: "Confirm cancellation" }).click();
    await expect(vp.getByRole("dialog")).not.toBeVisible();
    await expect(vp.locator(".section-head .badge")).toHaveText("Cancelled");
    const automatic = await submitApi(["degree"]);
    await vp.goto("/verifier/requests/" + automatic.id);
    await vp.getByRole("button", { name: "View result", exact: true }).click();
    await expect(
      vp.getByText(
        "Every disclosed claim verified independently in this browser.",
      ),
    ).toBeVisible();
    checks.push("Manual denial, automatic approval, and cancellation controls");
    await vp.goto("/verifier/history");
    await vp
      .getByLabel("Search requests")
      .fill("Classroom education verification");
    await vp.getByLabel("Request status").selectOption("PARTIAL");
    await expect(
      vp
        .getByRole("row")
        .filter({ hasText: "Classroom education verification" }),
    ).toBeVisible();
    await vp.getByLabel("Request status").selectOption("DENIED");
    await expect(vp.getByText("No requests match your filters.")).toBeVisible();
    await vp.getByLabel("Request status").selectOption("");
    await vp.getByLabel("Submitted from (UTC)").fill("2099-01-01");
    await expect(vp.getByText("No requests match your filters.")).toBeVisible();
    await vp.getByLabel("Submitted from (UTC)").fill("");
    await vp.getByLabel("Submitted through (UTC)").fill("2000-01-01");
    await expect(vp.getByText("No requests match your filters.")).toBeVisible();
    const ownerDocs = await (
        await owner.context.request.get("/api/v1/documents")
      ).json(),
      age = ownerDocs.find((d) => d.type === "AGE");
    await op.goto("/owner/consent");
    await op.getByRole("button", { name: "Create rule", exact: true }).click();
    let dialog = op.getByRole("dialog");
    await dialog
      .getByLabel("Verifier", { exact: true })
      .selectOption({ label: "ABC Technologies (Demo)" });
    await dialog.getByLabel("Credential document").selectOption(age.id);
    await dialog.getByLabel("Field", { exact: true }).selectOption("over18");
    await dialog.getByLabel("Consent action").selectOption("ASK");
    await dialog.getByRole("button", { name: "Save rule" }).click();
    await expect(dialog).not.toBeVisible();
    await op.getByLabel("Search rules").fill("Age Threshold");
    let ageRow = op.getByRole("row").filter({ hasText: "Demo Age Threshold" });
    await ageRow.getByRole("button", { name: "Edit", exact: true }).click();
    dialog = op.getByRole("dialog");
    await dialog.getByLabel("Consent action").selectOption("AUTO_APPROVE");
    await dialog.getByRole("button", { name: "Save rule" }).click();
    await expect(dialog).not.toBeVisible();
    await ageRow.getByRole("button", { name: "Disable", exact: true }).click();
    await expect(
      ageRow.getByRole("button", { name: "Enable", exact: true }),
    ).toBeVisible();
    await ageRow.getByRole("button", { name: "Enable", exact: true }).click();
    await expect(
      ageRow.getByRole("button", { name: "Disable", exact: true }),
    ).toBeVisible();
    const ageRequest = await submitApi(["over18"], age.id);
    await vp.goto("/verifier/requests/" + ageRequest.id);
    await vp.getByRole("button", { name: "View result", exact: true }).click();
    await expect(
      vp.getByText(
        "Every disclosed claim verified independently in this browser.",
      ),
    ).toBeVisible();
    const ageResult = await (
      await verifier.context.request.get(
        "/api/v1/verification/requests/" + ageRequest.id + "/result",
      )
    ).json();
    expect(ageResult.claims.map((c) => c.field)).toEqual(["over18"]);
    expect(
      Buffer.from(ageResult.claims[0].signed_payload, "base64").toString(),
    ).not.toMatch(/birth/i);
    await ageRow.getByRole("button", { name: "Delete", exact: true }).click();
    await op.getByRole("button", { name: "Confirm delete" }).click();
    await expect(op.getByRole("dialog")).not.toBeVisible();
    await expect(ageRow).not.toBeVisible();
    checks.push(
      "Rule edit, disable, enable, search and delete; age threshold with valid proof and no birth date",
    );
    const ownerMe = await (
      await owner.context.request.get("/api/v1/auth/me")
    ).json();
    for (let i = 0; i < 6; i++)
      expect(
        (
          await owner.context.request.post("/api/v1/documents/import", {
            headers: { "X-CSRF-Token": ownerMe.csrf },
            data: {
              title: "Pagination fixture " + i,
              attachment: { content: png.toString("base64") },
            },
          })
        ).status(),
      ).toBe(201);
    await op.goto("/owner/documents");
    await op.getByLabel("Search documents").fill("Browser Demo Education");
    await expect(
      op.getByRole("row").filter({ hasText: "Browser Demo Education" }),
    ).toBeVisible();
    await op.getByLabel("Category", { exact: true }).selectOption("Education");
    await op.getByLabel("Status", { exact: true }).selectOption("VALID");
    await op.getByLabel("Sort", { exact: true }).selectOption("title");
    await expect(
      op.getByRole("row").filter({ hasText: "Browser Demo Education" }),
    ).toBeVisible();
    await op.getByLabel("Search documents").fill("");
    await op.getByLabel("Category", { exact: true }).selectOption("");
    await op.getByLabel("Status", { exact: true }).selectOption("");
    await op.getByRole("button", { name: "Next", exact: true }).click();
    await expect(op.getByText(/Page 2 of/)).toBeVisible();
    await op.getByRole("button", { name: "Previous", exact: true }).click();
    await expect(op.getByText(/Page 1 of/)).toBeVisible();
    checks.push(
      "Document search, category/status filters, sorting and pagination",
    );
    await ip.goto("/issuer/issue");
    await ip.getByLabel("Title", { exact: true }).fill("Disposable draft");
    await ip.getByRole("button", { name: "Save draft", exact: true }).click();
    const draft = ip.locator(".draft").filter({ hasText: "Disposable draft" });
    await draft.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(draft).not.toBeVisible();
    checks.push("Draft deletion");
    run([
      "-m",
      "scripts.admin",
      "client",
      "--email",
      "verifier.a@demo.test",
      "--output",
      path.join(root, ".local", schema, "integration.credentials.json"),
    ]);
    await vp.goto("/verifier/organization");
    await vp
      .getByLabel("Organisation display name")
      .fill("ABC Technologies (Demo) Updated");
    await vp.getByRole("button", { name: "Save organisation" }).click();
    await expect(
      vp.getByText("Organisation updated", { exact: true }),
    ).toBeVisible();
    await vp.getByRole("button", { name: "Revoke client" }).click();
    await vp.getByRole("button", { name: "Confirm revocation" }).click();
    await expect(vp.getByRole("dialog")).not.toBeVisible();
    await expect(
      vp.getByRole("button", { name: "Revoke client" }),
    ).toBeDisabled();
    await ip.goto("/issuer/registry");
    await ip.locator("summary").first().click();
    await expect(ip.locator("pre").first()).toContainText("BEGIN PUBLIC KEY");
    checks.push(
      "Organisation settings, public registry and API client revocation",
    );
    await op.goto("/settings");
    await op.getByLabel("Display name").fill("Discarded edit");
    await op.getByRole("button", { name: "Cancel changes" }).click();
    await expect(op.getByLabel("Display name")).toHaveValue("Asha Demo");
    await op.getByLabel("Display name").fill("Asha Browser Demo");
    await op.getByLabel("Timezone", { exact: true }).selectOption("UTC");
    await op.getByLabel("Receive new in-app notifications").uncheck();
    await expect(op.getByText("You have unsaved changes.")).toBeVisible();
    await op.getByRole("button", { name: "Save changes" }).click();
    await expect(op.getByText("Profile saved")).toBeVisible();
    await op.reload();
    await expect(op.getByLabel("Display name")).toHaveValue(
      "Asha Browser Demo",
    );
    await expect(op.getByLabel("Timezone", { exact: true })).toHaveValue("UTC");
    await expect(
      op.getByLabel("Receive new in-app notifications"),
    ).not.toBeChecked();
    restarting = true;
    await stop(server);
    let offline = false;
    try {
      await fetch("http://127.0.0.1:8001/health", {
        signal: AbortSignal.timeout(1000),
      });
    } catch {
      offline = true;
    }
    expect(offline).toBe(true);
    server = start(
      python,
      [
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        "8001",
        "--no-access-log",
      ],
      backend,
    );
    await wait("http://127.0.0.1:8001/health");
    restarting = false;
    await op.reload();
    await expect(op.getByLabel("Display name")).toHaveValue(
      "Asha Browser Demo",
    );
    checks.push(
      "Settings persist through reload and real backend process restart",
    );
    await op.goto("/owner/dashboard");
    const search = op.getByRole("textbox", { name: "Search your workspace" });
    await search.fill("Browser Demo");
    await expect(op.locator(".search-results a").first()).toBeVisible();
    await search.press("ArrowDown");
    await expect(op.locator(".search-results a").first()).toBeFocused();
    await op.keyboard.press("Escape");
    await op.getByRole("button", { name: /Notifications, / }).click();
    await expect(
      op.getByRole("region", { name: "Notifications" }),
    ).toBeVisible();
    const notificationLink = (
      await (await owner.context.request.get("/api/v1/notifications")).json()
    ).items[0].link;
    await op.locator(".notification").first().click();
    await expect(op).toHaveURL("http://localhost:5174" + notificationLink);
    await op.goto("/owner/dashboard");
    await op.getByRole("button", { name: /Notifications, / }).click();
    await op.getByRole("button", { name: "Mark all read" }).click();
    await op.keyboard.press("Escape");
    checks.push(
      "Permission-scoped search keyboard navigation and notifications mark-as-read",
    );
    const dashboard = await (
      await owner.context.request.get("/api/v1/dashboard")
    ).json();
    const requestList = await (
      await owner.context.request.get("/api/v1/verification/requests")
    ).json();
    expect(dashboard.pending).toBe(
      requestList.filter((r) => r.status === "PENDING").length,
    );
    expect(dashboard.recent_requests.every((r) => r.status === "PENDING")).toBe(
      true,
    );
    expect(
      (await (await owner.context.request.get("/api/v1/notifications")).json())
        .unread,
    ).toBe(0);
    checks.push(
      "Dashboard pending counts match request records and notification counts refresh",
    );
    for (const width of [1440, 1024, 768, 390]) {
      await op.setViewportSize({ width, height: 950 });
      await op.goto("/owner/dashboard");
      await expect(
        op.getByRole("heading", { name: "Recent credentials", exact: true }),
      ).toBeVisible();
      expect(
        await op.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await op.screenshot({
        path: path.join(output, "dashboard-" + width + ".png"),
        fullPage: true,
      });
      if (width <= 768) {
        await op.getByRole("button", { name: "Open navigation" }).click();
        await expect(
          op.getByRole("dialog", { name: "Navigation" }),
        ).toBeVisible();
        await op.keyboard.press("Escape");
        await expect(
          op.getByRole("dialog", { name: "Navigation" }),
        ).not.toBeVisible();
      }
      await op.goto("/owner/requests/" + requestId);
      await expect(
        op.getByRole("heading", { name: "Field-level decisions", exact: true }),
      ).toBeVisible();
      expect(
        await op.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await op.screenshot({
        path: path.join(output, "request-" + width + ".png"),
        fullPage: true,
      });
    }
    checks.push(
      "1440, 1024, 768, 390 widths; no page overflow; accessible mobile drawer and request table",
    );
    await ip.goto("/issuer/documents/" + docId);
    await ip.getByRole("button", { name: "Revoke", exact: true }).click();
    await ip
      .getByLabel("Reason", { exact: true })
      .fill("Classroom completion revocation");
    await ip.getByRole("button", { name: "Confirm revocation" }).click();
    await expect(ip.getByRole("dialog")).not.toBeVisible();
    expect(
      (
        await verifier.context.request.get(
          "/api/v1/verification/requests/" + requestId + "/result",
        )
      ).status(),
    ).toBe(409);
    checks.push("Revocation blocks subsequent disclosure");
    await ip.getByRole("link", { name: "Create replacement" }).click();
    await expect(ip.getByLabel("Degree", { exact: true })).toHaveValue(
      "Browser Demo B.Tech",
    );
    await ip
      .getByLabel("Title", { exact: true })
      .fill("Replacement Browser Credential");
    await ip.getByRole("button", { name: "Review credential" }).click();
    await ip.getByRole("button", { name: "Confirm and issue" }).click();
    await expect(
      ip.getByRole("heading", { name: "Replacement Browser Credential" }),
    ).toBeVisible();
    checks.push("Immutable correction through a linked replacement version");
    await op.setViewportSize({ width: 1440, height: 950 });
    await op.goto("/audit");
    await op
      .getByRole("textbox", { name: "Search audit metadata" })
      .fill("DISCLOSURE");
    await op.getByLabel("Event type").selectOption("DISCLOSURE");
    await expect(
      op.getByRole("row").filter({ hasText: "Disclosure" }).first(),
    ).toBeVisible();
    const auditDownload = op.waitForEvent("download");
    await op.getByRole("button", { name: "Export filtered metadata" }).click();
    await auditDownload;
    await op
      .getByRole("button", { name: "Details", exact: true })
      .first()
      .click();
    await expect(op.getByRole("dialog")).toContainText("shared");
    await op.getByRole("button", { name: "Close dialog" }).click();
    const otherTab = await owner.context.newPage();
    await otherTab.goto("http://localhost:5174/owner/dashboard");
    await op.getByRole("button", { name: "Log out", exact: true }).click();
    await expect(
      op.getByRole("heading", { name: "Sign in to CredVault" }),
    ).toBeVisible();
    await expect(
      otherTab.getByRole("heading", { name: "Sign in to CredVault" }),
    ).toBeVisible();
    expect(
      (await owner.context.request.get("/api/v1/documents/" + docId)).status(),
    ).toBe(401);
    expect((await owner.context.request.get("/api/v1/events")).status()).toBe(
      401,
    );
    await op.goBack();
    await expect(
      op.getByRole("heading", { name: "Sign in to CredVault" }),
    ).toBeVisible();
    checks.push(
      "Audit export, logout invalidation, another tab and browser Back",
    );
    await op.getByRole("link", { name: "Create account", exact: true }).click();
    await op.getByLabel("Full name").fill("New Browser Owner");
    await op
      .getByLabel("Email", { exact: true })
      .fill("browser.owner@demo.test");
    await op
      .getByLabel("Password", { exact: true })
      .fill("Browser-only-password-2026");
    await op
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await expect(
      op.getByText("Account created. You can sign in."),
    ).toBeVisible();
    async function signInNew(pass) {
      await op
        .getByLabel("Email", { exact: true })
        .fill("browser.owner@demo.test");
      await op.getByLabel("Password", { exact: true }).fill(pass);
      await op.getByRole("button", { name: "Sign in", exact: true }).click();
    }
    await signInNew("wrong-password");
    await expect(op.getByRole("alert")).toContainText(
      "Incorrect email or password",
    );
    await signInNew("Browser-only-password-2026");
    await expect(
      op.getByRole("heading", { name: "Dashboard", exact: true }),
    ).toBeVisible();
    await op.goto("/issuer/issue");
    await expect(
      op.getByRole("heading", { name: "Access restricted" }),
    ).toBeVisible();
    await op.getByRole("link", { name: "Help", exact: true }).click();
    await expect(
      op.getByRole("heading", { name: /Help/ }).first(),
    ).toBeVisible();
    await op.getByRole("button", { name: /Account menu/ }).click();
    await op
      .locator(".account-popover")
      .getByRole("link", { name: "Account settings", exact: true })
      .click();
    await op
      .getByLabel("Current password", { exact: true })
      .fill("Browser-only-password-2026");
    await op
      .getByLabel("New password", { exact: true })
      .fill("Browser-changed-password-2026");
    await op
      .getByRole("button", { name: "Change password", exact: true })
      .click();
    await op.getByRole("button", { name: "Confirm password change" }).click();
    await expect(
      op.getByRole("heading", { name: "Sign in to CredVault" }),
    ).toBeVisible();
    await signInNew("Browser-changed-password-2026");
    await expect(
      op.getByRole("heading", { name: "Dashboard", exact: true }),
    ).toBeVisible();
    await op.getByRole("button", { name: "Log out", exact: true }).click();
    await op.getByRole("link", { name: "Forgot password?" }).click();
    await op
      .getByLabel("Email", { exact: true })
      .fill("browser.owner@demo.test");
    await op.getByRole("button", { name: "Create reset link" }).click();
    await expect(op.getByText(/No email was sent/)).toBeVisible();
    const mail = fs
      .readdirSync(env.MAILBOX_PATH)
      .map((name) => fs.readFileSync(path.join(env.MAILBOX_PATH, name), "utf8"))
      .find((text) => text.includes("To: browser.owner@demo.test"));
    expect(mail).toBeTruthy();
    const resetUrl = mail.match(/http:\/\/localhost:5174\/reset\?token=\S+/)[0];
    await op.goto(resetUrl);
    await op
      .getByLabel("Password", { exact: true })
      .fill("Browser-reset-password-2026");
    await op.getByRole("button", { name: "Save password" }).click();
    await expect(
      op.getByText("Password reset. Sign in with your new password."),
    ).toBeVisible();
    await signInNew("Browser-reset-password-2026");
    await expect(
      op.getByRole("heading", { name: "Dashboard", exact: true }),
    ).toBeVisible();
    checks.push(
      "Owner registration, failed login feedback, role forbidden screen, help, account menu, password change and mail-sink reset",
    );
    expect(errors).toEqual([]);
    expect(failures).toEqual([]);
    fs.writeFileSync(
      path.join(output, "browser-report.json"),
      JSON.stringify(
        {
          run_at: new Date().toISOString(),
          passed: true,
          checks,
          errors,
          failures,
          expectedRestartFailures: restartFailures,
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ passed: true, checks }, null, 2));
  }
} catch (e) {
  if (browser) {
    const contexts = browser.contexts();
    for (let i = 0; i < contexts.length; i++) {
      const page = contexts[i].pages()[0];
      if (page)
        await page
          .screenshot({
            path: path.join(output, "failure-" + i + ".png"),
            fullPage: true,
          })
          .catch(() => {});
    }
  }
  console.error(e);
  console.error("App errors:", errors, "Server failures:", failures);
  process.exitCode = 1;
} finally {
  await browser?.close();
  for (const c of children) await stop(c);
  if (!/^cv_browser_[a-f0-9]{32}$/.test(schema))
    throw new Error("Unsafe test schema");
  await admin.query("DROP SCHEMA " + schema + " CASCADE");
  await admin.end();
}
