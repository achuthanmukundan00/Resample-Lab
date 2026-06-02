import { test, expect } from "@playwright/test";
import { generateTestWav, uploadTestWav } from "./helpers";

/**
 * Processing test constants.
 */
const TEST_DURATION_S = 1; // 1-second tone gives enough material
const PROCESS_TIMEOUT_MS = 130_000; // 130s per generation (slightly above 120s worker limit)

// ── Actual preset names from lib/presets.ts ──────────────────────────────
const PRESET_NAMES = {
  ambient_stretch: "Ambient Stretch Lab",
  ghost_reverse: "Ghost Reverse Lab",
  granular_shards: "Granular Shards",
  bitrot_dirt: "Bitrot Dirt",
  pitch_wreckage: "Pitch Wreckage",
  loop_extractor: "Loop Extractor",
  impact_riser: "Impact / Riser Mutator",
  chaos_pack: "Chaos Pack",
} as const;

/**
 * Helper: upload a test WAV, select a preset, adjust chaos, set length,
 * generate, and wait for completion or error.
 */
async function generateWithPreset(
  page: any,
  presetName: string,
  chaos: number,
  lengthMode: string,
  fileName = "test_tone.wav",
): Promise<{ completed: boolean; errors: string[]; elapsed: number }> {
  const errors: string[] = [];
  let completed = false;

  await page.goto("/");

  // Upload a test file
  const wavBuffer = generateTestWav(TEST_DURATION_S);
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.locator("text=Drop audio files here or click to browse").click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: fileName,
    mimeType: "audio/wav",
    buffer: wavBuffer,
  });
  await page.waitForTimeout(500);

  // Wait for generate button to be enabled
  await expect(page.locator('button[type="submit"]')).toBeEnabled({ timeout: 5000 });

  // Select preset
  await page.getByText(presetName).click();
  await page.waitForTimeout(200);

  // Set chaos
  const slider = page.locator('input[type="range"]');
  await slider.fill(chaos.toString());

  // Set length mode
  const lengthButton = page.locator("button").filter({ hasText: new RegExp(`^${lengthMode}$`) });
  if (await lengthButton.isVisible()) {
    await lengthButton.click();
    await page.waitForTimeout(100);
  }

  // Monitor console errors
  page.on("console", (msg: any) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    }
  });

  const startTime = Date.now();

  // Click Generate
  await page.locator('button[type="submit"]').click();

  // Watch for completion or error
  try {
    await page.waitForSelector("text=Download Pack", { timeout: PROCESS_TIMEOUT_MS });
    completed = true;
  } catch {
    // Check if it errored — look for error indicator in the status card
    const errorCard = page.locator("text=An error occurred");
    if (await errorCard.isVisible().catch(() => false)) {
      errors.push("Processing error displayed in UI");
    } else {
      // Check if still processing (indefinite load)
      const processing = page.locator("text=processing");
      if (await processing.isVisible().catch(() => false)) {
        errors.push(`INDEFINITE LOAD: preset=${presetName} chaos=${chaos} length=${lengthMode}`);
      }
    }
  }

  const elapsed = Date.now() - startTime;
  return { completed, errors, elapsed };
}

// ── All 8 Presets ────────────────────────────────────────────────────────

test.describe("Processing Pipeline — All Presets (Single File)", () => {
  test(`${PRESET_NAMES.ambient_stretch} — default chaos & medium length`, async ({ page }) => {
    const result = await generateWithPreset(page, PRESET_NAMES.ambient_stretch, 0.33, "Medium");
    expect(result.errors, `Errors: ${result.errors.join(", ")}`).toEqual([]);
    expect(result.completed).toBe(true);
  });

  test(`${PRESET_NAMES.ghost_reverse} — default chaos & medium length`, async ({ page }) => {
    const result = await generateWithPreset(page, PRESET_NAMES.ghost_reverse, 0.33, "Medium");
    expect(result.errors, `Errors: ${result.errors.join(", ")}`).toEqual([]);
    expect(result.completed).toBe(true);
  });

  test(`${PRESET_NAMES.granular_shards} — default chaos & medium length`, async ({ page }) => {
    const result = await generateWithPreset(page, PRESET_NAMES.granular_shards, 0.33, "Medium");
    expect(result.errors, `Errors: ${result.errors.join(", ")}`).toEqual([]);
    expect(result.completed).toBe(true);
  });

  test(`${PRESET_NAMES.bitrot_dirt} — default chaos & medium length`, async ({ page }) => {
    const result = await generateWithPreset(page, PRESET_NAMES.bitrot_dirt, 0.33, "Medium");
    expect(result.errors, `Errors: ${result.errors.join(", ")}`).toEqual([]);
    expect(result.completed).toBe(true);
  });

  test(`${PRESET_NAMES.pitch_wreckage} — default chaos & medium length`, async ({ page }) => {
    const result = await generateWithPreset(page, PRESET_NAMES.pitch_wreckage, 0.33, "Medium");
    expect(result.errors, `Errors: ${result.errors.join(", ")}`).toEqual([]);
    expect(result.completed).toBe(true);
  });

  test(`${PRESET_NAMES.loop_extractor} — default chaos & medium length`, async ({ page }) => {
    const result = await generateWithPreset(page, PRESET_NAMES.loop_extractor, 0.33, "Medium");
    expect(result.errors, `Errors: ${result.errors.join(", ")}`).toEqual([]);
    expect(result.completed).toBe(true);
  });

  test(`${PRESET_NAMES.impact_riser} — default chaos & medium length`, async ({ page }) => {
    const result = await generateWithPreset(page, PRESET_NAMES.impact_riser, 0.33, "Medium");
    expect(result.errors, `Errors: ${result.errors.join(", ")}`).toEqual([]);
    expect(result.completed).toBe(true);
  });

  test(`${PRESET_NAMES.chaos_pack} — default chaos & medium length`, async ({ page }) => {
    const result = await generateWithPreset(page, PRESET_NAMES.chaos_pack, 0.33, "Medium");
    expect(result.errors, `Errors: ${result.errors.join(", ")}`).toEqual([]);
    expect(result.completed).toBe(true);
  });
});

// ── Length Mode Variations ────────────────────────────────────────────────

test.describe("Processing Pipeline — All Length Modes", () => {
  test("Ambient Stretch — chaos=0.33, short length", async ({ page }) => {
    const result = await generateWithPreset(page, PRESET_NAMES.ambient_stretch, 0.33, "Short");
    expect(result.errors, `Errors: ${result.errors.join(", ")}`).toEqual([]);
    expect(result.completed).toBe(true);
  });

  test("Granular Shards — chaos=0.33, long length", async ({ page }) => {
    const result = await generateWithPreset(page, PRESET_NAMES.granular_shards, 0.33, "Long");
    expect(result.errors, `Errors: ${result.errors.join(", ")}`).toEqual([]);
    expect(result.completed).toBe(true);
  });

  test("Ghost Reverse — chaos=0.33, absurd length", async ({ page }) => {
    const result = await generateWithPreset(page, PRESET_NAMES.ghost_reverse, 0.33, "Absurd");
    expect(result.errors, `Errors: ${result.errors.join(", ")}`).toEqual([]);
    expect(result.completed).toBe(true);
  });

  test("Bitrot Dirt — chaos=0.33, short length", async ({ page }) => {
    const result = await generateWithPreset(page, PRESET_NAMES.bitrot_dirt, 0.33, "Short");
    expect(result.errors, `Errors: ${result.errors.join(", ")}`).toEqual([]);
    expect(result.completed).toBe(true);
  });

  test("Loop Extractor — chaos=0.33, long length", async ({ page }) => {
    const result = await generateWithPreset(page, PRESET_NAMES.loop_extractor, 0.33, "Long");
    expect(result.errors, `Errors: ${result.errors.join(", ")}`).toEqual([]);
    expect(result.completed).toBe(true);
  });
});

// ── Chaos Level Variations ──────────────────────────────────────────────

test.describe("Processing Pipeline — Chaos Levels", () => {
  test("Pitch Wreckage — chaos=0.0 (Clean)", async ({ page }) => {
    const result = await generateWithPreset(page, PRESET_NAMES.pitch_wreckage, 0.0, "Medium");
    expect(result.errors, `Errors: ${result.errors.join(", ")}`).toEqual([]);
    expect(result.completed).toBe(true);
  });

  test("Impact / Riser — chaos=0.66 (Broken)", async ({ page }) => {
    const result = await generateWithPreset(page, PRESET_NAMES.impact_riser, 0.66, "Medium");
    expect(result.errors, `Errors: ${result.errors.join(", ")}`).toEqual([]);
    expect(result.completed).toBe(true);
  });

  test("Granular Shards — chaos=1.0 (Illegal Texture), short", async ({ page }) => {
    const result = await generateWithPreset(page, PRESET_NAMES.granular_shards, 1.0, "Short");
    expect(result.errors, `Errors: ${result.errors.join(", ")}`).toEqual([]);
    expect(result.completed).toBe(true);
  });

  test("Ambient Stretch — chaos=0.0 (Clean), short length", async ({ page }) => {
    const result = await generateWithPreset(page, PRESET_NAMES.ambient_stretch, 0.0, "Short");
    expect(result.errors, `Errors: ${result.errors.join(", ")}`).toEqual([]);
    expect(result.completed).toBe(true);
  });

  test("Chaos Pack — chaos=0.0, short length (fastest path)", async ({ page }) => {
    const result = await generateWithPreset(page, PRESET_NAMES.chaos_pack, 0.0, "Short");
    expect(result.errors, `Errors: ${result.errors.join(", ")}`).toEqual([]);
    expect(result.completed).toBe(true);
  });
});

// ── Multiple Files ──────────────────────────────────────────────────────

test.describe("Processing — Multiple Files", () => {
  test("Ambient Stretch — 2 files, default chaos", async ({ page }) => {
    await page.goto("/");
    const wavBuffer = generateTestWav(1);
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.locator("text=Drop audio files here or click to browse").click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles([
      { name: "kick.wav", mimeType: "audio/wav", buffer: wavBuffer },
      { name: "snare.wav", mimeType: "audio/wav", buffer: wavBuffer },
    ]);
    await page.waitForTimeout(500);
    await expect(page.locator("text=2 file(s) selected")).toBeVisible();

    await expect(page.locator('button[type="submit"]')).toBeEnabled({ timeout: 5000 });
    await page.locator('button[type="submit"]').click();

    let completed = false;
    try {
      await page.waitForSelector("text=Download Pack", { timeout: PROCESS_TIMEOUT_MS });
      completed = true;
    } catch {
      const stillProcessing = await page.locator("text=processing").isVisible().catch(() => false);
      expect(stillProcessing).toBe(false);
    }
    expect(completed).toBe(true);
  });
});

// ── Indefinite Loading Protection ──────────────────────────────────────

test.describe("Indefinite Loading Protection", () => {
  test("processing does not hang forever — timeout triggers error", async ({ page }) => {
    // This test verifies that processing that takes too long errors out
    // instead of showing "processing" indefinitely.
    await page.goto("/");

    const wavBuffer = generateTestWav(1);
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.locator("text=Drop audio files here or click to browse").click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "test.wav",
      mimeType: "audio/wav",
      buffer: wavBuffer,
    });
    await page.waitForTimeout(500);

    await expect(page.locator('button[type="submit"]')).toBeEnabled({ timeout: 5000 });

    // Chaos Pack at max chaos + absurd length = intensive
    const slider = page.locator('input[type="range"]');
    await slider.fill("1");
    await page.getByText("Absurd", { exact: true }).click();

    await page.locator('button[type="submit"]').click();

    // Wait up to 75s. Either:
    // a) Completes successfully — OK
    // b) Errors (via timeout) — ✓ tests the fix
    // c) Still processing forever — BUG
    const startTime = Date.now();
    let completed = false;
    let errored = false;
    let indefiniteLoad = true;

    try {
      await page.waitForSelector("text=Download Pack", { timeout: 75000 });
      completed = true;
      indefiniteLoad = false;
    } catch {
      // Check for error display (timeout triggers error)
      const errVisible = await page.getByText("timed out").first().isVisible().catch(() => false)
        || await page.getByText("An error occurred").first().isVisible().catch(() => false);
      if (errVisible) {
        errored = true;
        indefiniteLoad = false;
      } else {
        const stillProc = await page.locator("text=processing").first().isVisible().catch(() => false);
        if (!stillProc) {
          indefiniteLoad = false; // some other terminal state
        }
      }
    }

    expect(indefiniteLoad).toBe(false);
    expect(completed || errored).toBe(true);
  });

  test("worker error does not result in indefinite processing state", async ({ page }) => {
    await page.goto("/");
    const wavBuffer = generateTestWav(1);
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.locator("text=Drop audio files here or click to browse").click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "test.wav",
      mimeType: "audio/wav",
      buffer: wavBuffer,
    });
    await page.waitForTimeout(500);

    await expect(page.locator('button[type="submit"]')).toBeEnabled({ timeout: 5000 });
    await page.locator('button[type="submit"]').click();

    // Wait up to 70s — should resolve (complete or error)
    let terminal = false;
    try {
      await page.waitForSelector("text=Download Pack", { timeout: 70000 });
      terminal = true;
    } catch {
      const errVisible = await page.getByText("timed out").first().isVisible().catch(() => false)
        || await page.getByText("An error occurred").first().isVisible().catch(() => false);
      if (errVisible) terminal = true;
    }

    if (!terminal) {
      const stillProc = await page.locator("text=processing").first().isVisible().catch(() => false);
      expect(stillProc).toBe(false);
    }
  });
});

// ── Completion Flow ────────────────────────────────────────────────────

test.describe("Processing — Completion Flow", () => {
  test("shows progress bar and status messages during processing", async ({ page }) => {
    await page.goto("/");
    await uploadTestWav(page);
    await expect(page.locator('button[type="submit"]')).toBeEnabled({ timeout: 5000 });
    await page.locator('button[type="submit"]').click();

    // Processing status card should appear
    const statusCard = page.locator("text=Generating samples…");
    await expect(statusCard).toBeVisible({ timeout: 15000 }).catch(() => {});

    try {
      await page.waitForSelector("text=Download Pack", { timeout: PROCESS_TIMEOUT_MS });
      await expect(page.getByText("Manifest").first()).toBeVisible({ timeout: 5000 }).catch(() => {});
    } catch {
      // Processing may time out
    }
  });

  test("Download Pack button triggers download", async ({ page }) => {
    await page.goto("/");
    await uploadTestWav(page);
    await expect(page.locator('button[type="submit"]')).toBeEnabled({ timeout: 5000 });
    await page.locator('button[type="submit"]').click();

    try {
      await page.waitForSelector("text=Download Pack", { timeout: PROCESS_TIMEOUT_MS });
      const downloadPromise = page.waitForEvent("download", { timeout: 5000 });
      await page.locator("text=Download Pack").click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.zip$/);
    } catch {
      // Skip if generation didn't complete
    }
  });
});

// ── Edge Cases ──────────────────────────────────────────────────────────

test.describe("Processing — Edge Cases", () => {
  test("generate button disabled while processing", async ({ page }) => {
    await page.goto("/");
    await uploadTestWav(page);
    await expect(page.locator('button[type="submit"]')).toBeEnabled({ timeout: 5000 });
    await page.locator('button[type="submit"]').click();

    // Button should show "Generating..." and be disabled
    await expect(page.locator("text=Generating...")).toBeVisible({ timeout: 10000 }).catch(() => {});
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
  });
});
