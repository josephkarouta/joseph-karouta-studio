"use client";

export type BrowserZipFile = {
  name: string;
  data: ArrayBuffer | Uint8Array;
};

type PreparedFile = {
  name: Uint8Array;
  data: Uint8Array;
  crc: number;
  offset: number;
};

const UTF8_FLAG = 0x0800;
const STORE_METHOD = 0;
const ZIP_VERSION = 20;
const CRC_TABLE = createCrcTable();

/** Creates a dependency-free, uncompressed ZIP that works in Finder and Windows Explorer. */
export function createBrowserZip(files: BrowserZipFile[]) {
  if (!files.length) throw new Error("There are no files to download.");
  if (files.length > 0xffff) throw new Error("Too many files were selected for one ZIP.");

  const encoder = new TextEncoder();
  const { date, time } = dosDateTime(new Date());
  const localParts: Uint8Array[] = [];
  const prepared: PreparedFile[] = [];
  let localOffset = 0;

  for (const file of files) {
    const name = encoder.encode(safeZipName(file.name));
    const data = file.data instanceof Uint8Array
      ? Uint8Array.from(file.data)
      : new Uint8Array(file.data.slice(0));
    if (data.byteLength > 0xffffffff) throw new Error(`${file.name} is too large for this ZIP.`);

    const header = new Uint8Array(30);
    const view = new DataView(header.buffer);
    write32(view, 0, 0x04034b50);
    write16(view, 4, ZIP_VERSION);
    write16(view, 6, UTF8_FLAG);
    write16(view, 8, STORE_METHOD);
    write16(view, 10, time);
    write16(view, 12, date);
    const crc = crc32(data);
    write32(view, 14, crc);
    write32(view, 18, data.byteLength);
    write32(view, 22, data.byteLength);
    write16(view, 26, name.byteLength);
    write16(view, 28, 0);

    prepared.push({ name, data, crc, offset: localOffset });
    localParts.push(header, name, data);
    localOffset += header.byteLength + name.byteLength + data.byteLength;
    if (localOffset > 0xffffffff) throw new Error("The ZIP is too large to create in the browser.");
  }

  const centralParts: Uint8Array[] = [];
  let centralSize = 0;
  for (const file of prepared) {
    const header = new Uint8Array(46);
    const view = new DataView(header.buffer);
    write32(view, 0, 0x02014b50);
    write16(view, 4, ZIP_VERSION);
    write16(view, 6, ZIP_VERSION);
    write16(view, 8, UTF8_FLAG);
    write16(view, 10, STORE_METHOD);
    write16(view, 12, time);
    write16(view, 14, date);
    write32(view, 16, file.crc);
    write32(view, 20, file.data.byteLength);
    write32(view, 24, file.data.byteLength);
    write16(view, 28, file.name.byteLength);
    write16(view, 30, 0);
    write16(view, 32, 0);
    write16(view, 34, 0);
    write16(view, 36, 0);
    write32(view, 38, 0);
    write32(view, 42, file.offset);
    centralParts.push(header, file.name);
    centralSize += header.byteLength + file.name.byteLength;
  }

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  write32(endView, 0, 0x06054b50);
  write16(endView, 4, 0);
  write16(endView, 6, 0);
  write16(endView, 8, prepared.length);
  write16(endView, 10, prepared.length);
  write32(endView, 12, centralSize);
  write32(endView, 16, localOffset);
  write16(endView, 20, 0);

  return new Blob([...localParts, ...centralParts, end] as BlobPart[], {
    type: "application/zip",
  });
}

function safeZipName(value: string) {
  return String(value || "heyy-studio-asset")
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.replace(/[\u0000-\u001f\u007f]+/g, "-")
    .trim()
    .slice(0, 180) || "heyy-studio-asset";
}

function createCrcTable() {
  const table = new Uint32Array(256);
  for (let value = 0; value < 256; value += 1) {
    let crc = value;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[value] = crc >>> 0;
  }
  return table;
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(value: Date) {
  const year = Math.max(1980, value.getFullYear());
  return {
    date: ((year - 1980) << 9) | ((value.getMonth() + 1) << 5) | value.getDate(),
    time: (value.getHours() << 11) | (value.getMinutes() << 5) | Math.floor(value.getSeconds() / 2),
  };
}

function write16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function write32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true);
}
