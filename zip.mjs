// Minimal, dependency-free ZIP writer. Pure Uint8Array + DataView so the exact
// same code runs in Node (the build) and in the browser (the editor's
// download buttons). Entries are STORED (uncompressed): the ZIP is only an
// upload container — Google unpacks it — so compression buys nothing and this
// keeps us free of any zlib/CompressionStream branching.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const enc = new TextEncoder();

// Fixed DOS date/time (2024-01-01) so builds are byte-for-byte reproducible.
const DOS_DATE = ((2024 - 1980) << 9) | (1 << 5) | 1;
const DOS_TIME = 0;

/**
 * @param {Array<{name:string,data:Uint8Array}>} files
 * @returns {Uint8Array} the .zip bytes
 */
export function makeZip(files) {
  const parts = [];
  const central = [];
  let offset = 0;

  for (const f of files) {
    const name = enc.encode(f.name);
    const data = f.data;
    const crc = crc32(data);

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // local file header sig
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(8, 0, true); // method: store
    lv.setUint16(10, DOS_TIME, true);
    lv.setUint16(12, DOS_DATE, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true); // compressed size
    lv.setUint32(22, data.length, true); // uncompressed size
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    parts.push(local, data);

    const cen = new Uint8Array(46 + name.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true); // central dir header sig
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true); // version needed
    cv.setUint16(10, 0, true); // method: store
    cv.setUint16(12, DOS_TIME, true);
    cv.setUint16(14, DOS_DATE, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true); // local header offset
    cen.set(name, 46);
    central.push(cen);

    offset += local.length + data.length;
  }

  let cdLen = 0;
  for (const c of central) cdLen += c.length;

  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); // end of central dir sig
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdLen, true);
  ev.setUint32(16, offset, true);

  const total = offset + cdLen + end.length;
  const out = new Uint8Array(total);
  let p = 0;
  for (const part of parts) {
    out.set(part, p);
    p += part.length;
  }
  for (const c of central) {
    out.set(c, p);
    p += c.length;
  }
  out.set(end, p);
  return out;
}

// Which local files (fonts, images) does a rendered banner reference? Shared by
// the build and the editor so both bundle exactly the same asset set.
export function referencedAssets(html) {
  const re = /(?:url\(|src\s*[:=]\s*)['"]?([\w./-]+\.(?:woff2?|jpe?g|png|gif|svg))/gi;
  const out = new Set();
  let m;
  while ((m = re.exec(html))) {
    if (!/^(https?:|data:|\/)/.test(m[1])) out.add(m[1]);
  }
  return [...out];
}
