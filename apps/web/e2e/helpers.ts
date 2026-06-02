import { Page } from "@playwright/test";

/** Generate a small valid 16-bit PCM WAV file as a Buffer */
export function generateTestWav(
  durationSec = 0.5,
  sampleRate = 44100,
  frequency = 440,
): Buffer {
  const numChannels = 1;
  const bitDepth = 16;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * numChannels * (bitDepth / 8);

  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);

  // fmt chunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * (bitDepth / 8), 28); // byte rate
  buffer.writeUInt16LE(numChannels * (bitDepth / 8), 32); // block align
  buffer.writeUInt16LE(bitDepth, 34); // bits per sample

  // data chunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Write sine wave samples
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.sin((2 * Math.PI * frequency * i) / sampleRate);
    const intSample = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
    buffer.writeInt16LE(intSample, 44 + i * 2);
  }

  return buffer;
}

/** Upload a test WAV file via the dropzone */
export async function uploadTestWav(page: Page, fileName = "test_tone.wav") {
  const wavBuffer = generateTestWav();
  const fileChooserPromise = page.waitForEvent("filechooser");
  // Click the dropzone to open file picker
  await page.locator("text=Drop audio files here or click to browse").click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: fileName,
    mimeType: "audio/wav",
    buffer: wavBuffer,
  });
  // Wait for files to be registered
  await page.waitForTimeout(500);
}
