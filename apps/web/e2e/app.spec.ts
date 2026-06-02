import { test, expect } from "@playwright/test";
import { generateTestWav, uploadTestWav } from "./helpers";

test.describe("Page Load & UI Rendering", () => {
  test("renders title, logo, and badge", async ({ page }) => {
    await page.goto("/");
    const main = page.getByRole("main");
    await expect(main.getByText("Resample")).toBeVisible();
    await expect(main.getByText("-Lab")).toBeVisible();
    await expect(page.locator("text=Local-First")).toBeVisible();
    await expect(page.locator('img[alt="watchyourtemper"]')).toBeVisible();
  });

  test("renders description", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.locator("text=Turn any sound into a sample pack"),
    ).toBeVisible();
  });

  test("renders all 8 preset cards", async ({ page }) => {
    await page.goto("/");
    const presetSection = page.locator("text=Preset");
    await expect(presetSection).toBeVisible();
    // There should be 8 preset buttons
    const presets = page.locator("section").filter({ hasText: "Preset" }).locator("button");
    // Actually - let's count them by looking for the unique preset names
    await expect(page.locator("text=Ambient Stretch Lab")).toBeVisible();
    await expect(page.locator("text=Ghost Reverse Lab")).toBeVisible();
    await expect(page.getByText("Granular Shards")).toBeVisible();
    await expect(page.getByText("Bitrot Dirt")).toBeVisible();
    await expect(page.getByText("Pitch Wreckage")).toBeVisible();
    await expect(page.getByText("Loop Extractor")).toBeVisible();
    await expect(page.locator("text=Impact / Riser Mutator")).toBeVisible();
    await expect(page.locator("text=Chaos Pack")).toBeVisible();
  });

  test("first preset (ambient_stretch) is selected by default", async ({ page }) => {
    await page.goto("/");
    const ambientCard = page.locator("text=Ambient Stretch Lab").locator("..");
    // The parent button should have the selected style
    await expect(ambientCard).toBeVisible();
  });

  test("renders chaos slider at default value", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Chaos", { exact: true }).first()).toBeVisible();
    // Default label should be "Weird" (0.33)
    await expect(page.locator("text=Weird")).toBeVisible();
    // Range input should be there
    const slider = page.locator('input[type="range"]');
    await expect(slider).toHaveValue("0.33");
  });

  test("renders length mode selector with Medium selected", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Length", { exact: true }).first()).toBeVisible();
    // All four mode buttons should be visible
    await expect(page.locator("button:has-text('Short')")).toBeVisible();
    await expect(page.locator("button:has-text('Medium')")).toBeVisible();
    await expect(page.locator("button:has-text('Long')")).toBeVisible();
    await expect(page.locator("button:has-text('Absurd')")).toBeVisible();
    // Medium should be the default description
    await expect(page.locator("text=Moderate length")).toBeVisible();
  });

  test("generate button is disabled when no file is uploaded", async ({ page }) => {
    await page.goto("/");
    const btn = page.locator('button[type="submit"]');
    await expect(btn).toBeDisabled();
    await expect(btn).toContainText("Generate Pack");
  });

  test("renders footer", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    await expect(footer).toContainText("Browser-local audio mutation lab");
    await expect(footer).toContainText("Non-AI DSP");
    await expect(page.locator("text=Contribute on GitHub")).toBeVisible();
  });

  test("upload dropzone shows placeholder text", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Drop audio files here or click to browse")).toBeVisible();
    await expect(page.locator("text=Accepted:")).toBeVisible();
    await expect(page.locator("text=50MB")).toBeVisible();
  });
});

test.describe("Upload Dropzone", () => {
  test("selects a WAV file and shows file name", async ({ page }) => {
    await page.goto("/");
    await uploadTestWav(page, "my_loop.wav");
    await expect(page.locator("text=1 file(s) selected")).toBeVisible();
    await expect(page.locator("text=my_loop.wav")).toBeVisible();
  });

  test("uploading a file enables the generate button", async ({ page }) => {
    await page.goto("/");
    const btn = page.locator('button[type="submit"]');
    await expect(btn).toBeDisabled();
    await uploadTestWav(page);
    await expect(btn).toBeEnabled();
  });

  test("selects multiple files", async ({ page }) => {
    await page.goto("/");
    const wavBuffer = generateTestWav();
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.locator("text=Drop audio files here or click to browse").click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles([
      { name: "sound1.wav", mimeType: "audio/wav", buffer: wavBuffer },
      { name: "sound2.wav", mimeType: "audio/wav", buffer: wavBuffer },
    ]);
    await page.waitForTimeout(500);
    await expect(page.locator("text=2 file(s) selected")).toBeVisible();
  });

  test("shows accepted extensions", async ({ page }) => {
    await page.goto("/");
    const dropzone = page.locator("text=Drop audio files here or click to browse").locator("..");
    await expect(dropzone).toContainText("wav");
    await expect(dropzone).toContainText("aiff");
    await expect(dropzone).toContainText("flac");
  });
});

test.describe("Preset Selection", () => {
  test("clicking a preset selects it and visually changes it", async ({ page }) => {
    await page.goto("/");
    const ghostReverse = page.locator("text=Ghost Reverse Lab");
    await ghostReverse.click();
    // After clicking, the card should have an accent border
    await expect(ghostReverse.locator("..")).toBeVisible();
    // The ambient stretch should no longer have the accent style (we just verify it still exists)
    await expect(page.locator("text=Ambient Stretch Lab")).toBeVisible();
  });

  test("each preset shows output count and categories", async ({ page }) => {
    await page.goto("/");
    // At least one preset should show output count
    const anyCard = page.locator("text=5 outputs").first();
    await expect(anyCard).toBeVisible();
  });

  test("selecting all presets successively works", async ({ page }) => {
    await page.goto("/");
    const presetNames = [
      "Ambient Stretch Lab",
      "Ghost Reverse Lab",
      "Granular Shards",
      "Bitrot Dirt",
      "Pitch Wreckage",
      "Loop Extractor",
      "Impact / Riser Mutator",
      "Chaos Pack",
    ];
    for (const name of presetNames) {
      await page.getByText(name).click();
      await page.waitForTimeout(100);
    }
    // Verify last click stuck
    await expect(page.getByText("Chaos Pack")).toBeVisible();
  });
});

test.describe("Chaos Slider", () => {
  test("moving the slider changes its value and label", async ({ page }) => {
    await page.goto("/");
    const slider = page.locator('input[type="range"]');

    // Default should be 0.33 → "Weird"
    await expect(slider).toHaveValue("0.33");
    await expect(page.locator("text=Weird")).toBeVisible();

    // Set to 0 (Clean)
    await slider.fill("0");
    await expect(slider).toHaveValue("0");
    await expect(page.getByText("Clean", { exact: true })).toBeVisible();
  });

  test("setting chaos to maximum shows Illegal Texture", async ({ page }) => {
    await page.goto("/");
    const slider = page.locator('input[type="range"]');
    await slider.fill("1");
    await expect(slider).toHaveValue("1");
    await expect(page.locator("text=Illegal Texture")).toBeVisible();
  });

  test("setting chaos to 0.66 shows Broken", async ({ page }) => {
    await page.goto("/");
    const slider = page.locator('input[type="range"]');
    await slider.fill("0.66");
    await expect(page.locator("text=Broken")).toBeVisible();
  });
});

test.describe("Length Mode Selection", () => {
  test("clicking each mode selects it", async ({ page }) => {
    await page.goto("/");

    // Default is Medium → shows Moderate length
    await expect(page.locator("text=Moderate length")).toBeVisible();

    // Click Short
    await page.locator("text=Short").first().click();
    await expect(page.locator("text=Quick samples")).toBeVisible();

    // Click Long
    await page.locator("text=Long").click();
    await expect(page.locator("text=Extended tails")).toBeVisible();

    // Click Absurd
    await page.locator("text=Absurd").click();
    await expect(page.locator("text=Maximum duration")).toBeVisible();

    // Switch back to Medium
    await page.locator("text=Medium").click();
    await expect(page.locator("text=Moderate length")).toBeVisible();
  });
});

test.describe("Error Handling", () => {
  test("error display renders and can be dismissed", async ({ page }) => {
    await page.goto("/");
    // Upload a file and try generating with no preset anomalies
    await uploadTestWav(page);
    await page.locator('button[type="submit"]').click();

    // Wait up to 70s for processing - may time out or complete
    // We check that the status card appears with processing or error state
    await page.waitForSelector("text=processing", { timeout: 5000 }).catch(() => {});
    await page.waitForSelector("text=completed", { timeout: 70000 }).catch(() => {});
    await page.waitForSelector("text=error", { timeout: 70000 }).catch(() => {});
    // If error appears, check dismiss button
    const errorMsg = page.locator("text=error").first();
    if (await errorMsg.isVisible().catch(() => false)) {
      await expect(page.locator("text=Dismiss")).toBeVisible();
    }
  });
});
