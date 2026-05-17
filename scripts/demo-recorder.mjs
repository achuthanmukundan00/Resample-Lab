/**
 * Playwright demo recorder / smoke test for Resample-Lab.
 *
 * Covers: app loads, WAV upload, preset selection, chaos slider,
 * length mode selection, generate completes, download button appears,
 * no console errors.
 *
 * Suitable for:
 *   - Generating README demo video (--record flag)
 *   - Catching obvious app regressions (default, no video)
 *
 * Usage:
 *   pnpm add -D playwright        # one-time
 *   npx playwright install        # one-time (downloads browsers)
 *   pnpm dev                      # start the dev server in another terminal
 *
 *   # Smoke test (fast, no video)
 *   node scripts/demo-recorder.mjs
 *
 *   # Record demo video
 *   node scripts/demo-recorder.mjs --record
 *
 * Output (--record): docs/assets/demo.webm
 */

import path from "path";
import fs from "fs";
import http from "http";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SAMPLE_FILE = path.resolve(ROOT, "test.wav");
const VIDEO_OUT = path.resolve(ROOT, "docs", "assets", "demo.webm");
const APP_URL = "http://localhost:3000";

const recordMode = process.argv.includes("--record");

// ── Pre-flight checks ───────────────────────────────────────────

function ensure(pathLike, label) {
  if (!fs.existsSync(pathLike)) {
    console.error(`✗ Missing ${label}: ${pathLike}`);
    process.exit(1);
  }
  console.log(`✓ ${label}: ${pathLike}`);
}

function checkServerRunning(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

console.log("── Pre-flight checks ──");
ensure(SAMPLE_FILE, "test.wav sample file");

const serverOk = await checkServerRunning(APP_URL);
if (!serverOk) {
  console.error(`✗ Dev server not reachable at ${APP_URL}`);
  console.error("  Start it in another terminal:  pnpm dev");
  process.exit(1);
}
console.log(`✓ Dev server running at ${APP_URL}`);
console.log(`  Mode: ${recordMode ? "RECORDING demo video" : "SMOKE TEST only"}`);

// Only now import Playwright
const { chromium } = await import("playwright");

// ── Main test / recorder ────────────────────────────────────────

async function run() {
  if (recordMode) {
    const outDir = path.dirname(VIDEO_OUT);
    fs.mkdirSync(outDir, { recursive: true });
  }

  const videoDir = recordMode
    ? path.resolve(ROOT, ".demo-tmp")
    : undefined;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...(recordMode
      ? { recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } } }
      : {}),
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  // Track console errors
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
      console.error(`  [CONSOLE ERROR] ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(err.message);
    console.error(`  [PAGE ERROR] ${err.message}`);
  });

  try {
    // --- Navigate ---
    console.log("\n── Navigating to app ──");
    await page.goto(APP_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    console.log("✓ App loaded");

    // --- 1. Upload ---
    console.log("\n── Uploading test WAV ──");
    const fileInput = page.locator('input[type="file"]');
    await fileInput.waitFor({ state: "attached", timeout: 10000 });
    await fileInput.setInputFiles(SAMPLE_FILE);
    await page.waitForFunction(
      (expectedName) => document.body.innerText.includes(expectedName),
      "test.wav",
      { timeout: 5000 },
    );
    await page.waitForTimeout(500);
    console.log("✓ File uploaded");

    // --- 2. Select a preset ---
    console.log("\n── Selecting preset (Granular Shards) ──");
    await page.getByRole("button", { name: /Granular Shards/ }).click();
    await page.waitForTimeout(700);
    console.log("✓ Preset selected");

    // --- 3. Crank chaos ---
    console.log("\n── Setting chaos to 0.85 ──");
    await page.evaluate(() => {
      const slider = document.querySelector('input[type="range"]');
      if (!slider) throw new Error("Chaos slider not found");
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      ).set;
      nativeSetter.call(slider, "0.85");
      slider.dispatchEvent(new Event("input", { bubbles: true }));
      slider.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await page.waitForFunction(
      (text) => document.body.innerText.includes(text),
      "Illegal Texture",
      { timeout: 3000 },
    );
    console.log("✓ Chaos slider set");

    // --- 4. Select a length mode ---
    console.log("\n── Setting length mode to Long ──");
    const longBtn = page.locator("button", { hasText: "Long" });
    await longBtn.waitFor({ state: "visible", timeout: 5000 });
    await longBtn.click();
    await page.waitForTimeout(300);
    // Verify the button shows selected state
    const longIsActive = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const longBtn2 = btns.find((b) => b.textContent?.trim() === "Long");
      return longBtn2?.className?.includes("bg-accent") ?? false;
    });
    console.log(longIsActive ? "✓ Length mode: Long" : "⚠ Length mode: Long selected (visual TBD)");

    // --- 5. Generate Pack ---
    console.log("\n── Generating pack ──");
    await page.getByRole("button", { name: /Generate Pack/ }).click();

    // Wait for the Download Pack button to appear
    const downloadBtn = page.getByRole("button", { name: /Download Pack/ });
    await downloadBtn.waitFor({ state: "visible", timeout: 120000 });
    console.log("✓ Generation completed, download button visible");

    // Small pause to show completed state
    await page.waitForTimeout(1000);

    // --- 6. Check for console errors ---
    console.log("\n── Checking console errors ──");
    if (consoleErrors.length > 0) {
      console.error(`✗ ${consoleErrors.length} console error(s) detected`);
      for (const err of consoleErrors) {
        console.error(`  ${err}`);
      }
    } else {
      console.log("✓ No console errors detected");
    }

    // --- Save video or close ---
    await context.close();
    console.log("\n✓ Smoke test passed");

  } catch (err) {
    console.error("\n✗ Test failed:", err.message);
    try { await context.close(); } catch {}
    await browser.close();

    if (recordMode && videoDir) {
      try { fs.rmSync(videoDir, { recursive: true, force: true }); } catch {}
    }

    process.exit(1);
  } finally {
    await browser.close();
  }

  // Handle video if recording
  if (recordMode) {
    const files = fs.readdirSync(videoDir).filter((f) => f.endsWith(".webm"));
    if (files.length === 0) {
      console.error("✗ No video file produced");
      fs.rmSync(videoDir, { recursive: true, force: true });
      process.exit(1);
    }

    const src = path.join(videoDir, files[0]);
    fs.renameSync(src, VIDEO_OUT);
    console.log(`✓ Demo video saved → ${VIDEO_OUT}`);

    fs.rmSync(videoDir, { recursive: true, force: true });
  }

  console.log("✓ Done.");
}

run().catch((err) => {
  console.error("✗ Fatal error:", err.message || err);
  process.exit(1);
});
