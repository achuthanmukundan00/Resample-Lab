/** Minimal ZIP builder — stored (uncompressed) entries only. */

const CRC32_TABLE = new Int32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC32_TABLE[i] = c;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function strToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function u32(v: DataView, offset: number, val: number) {
  v.setUint32(offset, val, true);
}

function u16(v: DataView, offset: number, val: number) {
  v.setUint16(offset, val, true);
}

export function buildZip(files: { name: string; data: Uint8Array }[]): Blob {
  const localHeaders: (ArrayBuffer | Uint8Array)[] = [];
  const centralEntries: (ArrayBuffer | Uint8Array)[] = [];
  let centralOffset = 0;

  for (const file of files) {
    const nameBytes = strToBytes(file.name);
    const crc = crc32(file.data);
    const size = file.data.length;

    // Local file header
    const headerLen = 30 + nameBytes.length;
    const hdr = new ArrayBuffer(headerLen);
    const v = new DataView(hdr);
    v.setUint32(0, 0x04034b50, true); // signature
    u16(v, 4, 20); // version needed
    u16(v, 6, 0); // flags
    u16(v, 8, 0); // compression: stored
    u16(v, 10, 0); // mod time
    u16(v, 12, 0); // mod date
    u32(v, 14, crc);
    u32(v, 18, size); // compressed size
    u32(v, 22, size); // uncompressed size
    u16(v, 26, nameBytes.length);
    u16(v, 28, 0); // extra field length
    new Uint8Array(hdr).set(nameBytes, 30);

    localHeaders.push(hdr);
    localHeaders.push(file.data);

    // Central directory entry
    const centralLen = 46 + nameBytes.length;
    const cent = new ArrayBuffer(centralLen);
    const c = new DataView(cent);
    c.setUint32(0, 0x02014b50, true); // signature
    u16(c, 4, 20); // version made by
    u16(c, 6, 20); // version needed
    u16(c, 8, 0); // flags
    u16(c, 10, 0); // compression
    u16(c, 12, 0); // mod time
    u16(c, 14, 0); // mod date
    u32(c, 16, crc);
    u32(c, 20, size);
    u32(c, 24, size);
    u16(c, 28, nameBytes.length);
    u16(c, 30, 0); // extra field length
    u16(c, 32, 0); // comment length
    u16(c, 34, 0); // disk start
    u16(c, 36, 0); // internal attrs
    u32(c, 38, 0); // external attrs
    u32(c, 42, centralOffset); // offset
    new Uint8Array(cent).set(nameBytes, 46);

    centralEntries.push(cent);
    const chunkSize = headerLen + size;
    centralOffset += chunkSize;
  }

  // EOCD
  const cdSize = centralEntries.reduce((s, b) => s + b.byteLength, 0);
  const eocd = new ArrayBuffer(22);
  const e = new DataView(eocd);
  e.setUint32(0, 0x06054b50, true);
  u16(e, 4, 0); // disk
  u16(e, 6, 0); // cd disk
  u16(e, 8, files.length); // entries on disk
  u16(e, 10, files.length); // total entries
  u32(e, 12, cdSize);
  u32(e, 16, centralOffset);
  u16(e, 20, 0); // comment length

  return new Blob([...localHeaders, ...centralEntries, eocd] as BlobPart[], { type: "application/zip" });
}
