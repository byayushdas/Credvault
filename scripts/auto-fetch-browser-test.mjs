import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// UI contract tests use a deterministic API fixture; backend integration tests
// separately exercise real storage, authorization, consent and disclosure.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseURL = "http://127.0.0.1:5178";
const server = spawn(
  process.execPath,
  [
    path.join(root, "frontend/node_modules/vite/bin/vite.js"),
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    "5178",
    "--strictPort",
  ],
  { cwd: path.join(root, "frontend"), windowsHide: true, stdio: "ignore" },
);
let browser;
try {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      if ((await fetch(baseURL)).ok) break;
    } catch {}
    if (attempt === 49) throw new Error("Preview did not start");
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CREDVAULT_BROWSER
      ? { executablePath: process.env.CREDVAULT_BROWSER }
      : process.platform === "win32"
        ? { channel: "chrome" }
        : {}),
  });
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 1000 },
  });
  const documents = ["Degree Certificate", "Identity Certificate"].map(
    (title, index) => ({
      id: "document-" + index,
      owner_id: "test-owner",
      title,
      type: "DEGREE",
      category: "Education",
      issuer: "Test Institute",
      issuer_id: "test-issuer",
      status: "VALID",
      issued_at: "2026-01-01",
      expires_at: null,
      created_at: "2026-01-01",
      has_file: false,
      version: 1,
      auto_fetch: false,
      signature_valid: true,
      issuer_trusted: true,
      claims: { degree: "Test degree" },
    }),
  );
  let role = "OWNER";
  let failSave = false;
  let saves = 0;
  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url()).pathname.replace("/api/v1", "");
    let body;
    let status = 200;
    if (url === "/auth/me")
      body = {
        id: "test-owner",
        name: "Test Owner",
        email: "test@example.test",
        role,
        organization:
          role === "ISSUER"
            ? { id: "test-issuer", name: "Test Institute" }
            : null,
        timezone: "Asia/Kolkata",
        notifications: true,
        csrf: "test-csrf",
      };
    else if (url === "/events") {
      await route.abort();
      return;
    } else if (url === "/notifications") body = { unread: 0, items: [] };
    else if (url === "/documents") body = documents;
    else if (url.startsWith("/documents/")) {
      const doc = documents.find((d) => d.id === url.split("/")[2]);
      if (!doc) throw new Error("Unknown document route " + url);
      if (request.method() === "PATCH") {
        expect(url).toBe("/documents/" + doc.id + "/auto-fetch");
        expect(request.headers()["x-csrf-token"]).toBe("test-csrf");
        saves++;
        if (failSave) {
          status = 500;
          body = { detail: "Test save failed. Please retry." };
        } else doc.auto_fetch = request.postDataJSON().auto_fetch;
      }
      body ||= doc;
    } else if (url === "/dashboard")
      body = {
        pending: 0,
        documents: 2,
        recent_documents: [],
        recent_requests: [],
        recent_activity: [],
      };
    else body = [];
    await route.fulfill({ status, json: body });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/owner/documents");
  const degree = page.getByRole("switch", {
    name: "Auto fetch for Degree Certificate",
  });
  const identity = page.getByRole("switch", {
    name: "Auto fetch for Identity Certificate",
  });
  await expect(degree).not.toBeChecked();
  await expect(identity).not.toBeChecked();
  await degree.focus();
  await page.keyboard.press("Space");
  await expect(degree).toBeChecked();
  await expect(identity).not.toBeChecked();
  await page.reload();
  await expect(degree).toBeChecked();
  await page
    .getByRole("row")
    .filter({ hasText: "Degree Certificate" })
    .getByRole("link", { name: "View" })
    .click();
  await expect(degree).toBeChecked();
  await degree.click();
  await expect(degree).not.toBeChecked();
  failSave = true;
  await degree.click();
  await expect(page.getByRole("alert")).toContainText("Test save failed");
  await expect(degree).not.toBeChecked();
  failSave = false;
  await degree.click();
  await expect(degree).toBeChecked();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(saves).toBe(4);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(degree).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const output = path.join(root, ".local/auto-fetch-browser");
  fs.mkdirSync(output, { recursive: true });
  await page.screenshot({
    path: path.join(output, "mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/owner/documents");
  await page.screenshot({
    path: path.join(output, "documents.png"),
    fullPage: true,
  });
  role = "ISSUER";
  await page.goto("/issuer/documents");
  await expect(
    page.getByRole("heading", { name: "Issued Credentials", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("switch")).toHaveCount(0);
  await page.goto("/issuer/documents/document-0");
  await expect(
    page.getByRole("heading", { name: "Credential details", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("switch")).toHaveCount(0);
  expect(errors).toEqual([]);
  console.log(
    "PASS: per-document switch, keyboard access, persistence, detail-page editing, save failure/retry, mobile layout, owner-only controls.",
  );
} finally {
  if (browser) await browser.close();
  server.kill();
}
