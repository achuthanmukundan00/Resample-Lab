/** Write 16-bit PCM WAV from interleaved Float32Array samples. */
export function encodeWav(
  samples: Float32Array,
  sampleRate: number,
  numChannels: number,
): ArrayBuffer {
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = samples.length * bytesPerSample;
  const buf = new ArrayBuffer(44 + dataSize);
  const v = new DataView(buf);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++)
      v.setUint8(offset + i, str.charCodeAt(i));
  }

  writeString(0, "RIFF");
  v.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  v.setUint32(16, 16, true); // chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, numChannels, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * blockAlign, true); // byte rate
  v.setUint16(32, blockAlign, true);
  v.setUint16(34, bitDepth, true);
  writeString(36, "data");
  v.setUint32(40, dataSize, true);

  const offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(offset + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return buf;
}
