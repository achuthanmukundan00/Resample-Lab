/** Centralized DSP limits for browser-local processing. */
export const DSP = {
  MAX_FILES: 8,
  MAX_DURATION_PER_FILE_S: 300, // 5 minutes per decoded file
  MAX_OUTPUT_DURATION_S: 90, // default cap per generated sample
  ABSURD_OUTPUT_DURATION_S: 120, // ceiling for "absurd" length mode
  NORMALIZE_PEAK: 0.89, // -1 dBFS headroom
  SAMPLE_RATE: 48000,
  DEFAULT_FADE_IN_MS: 5,
  DEFAULT_FADE_OUT_MS: 20,
  DEFAULT_DC_BLOCK_HZ: 20,
} as const;
