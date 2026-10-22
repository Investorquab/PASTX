"use strict";

const CONTRACT_EXPORTS = new Set(["deploy", "call"]);

function fail(message) {
  throw new Error("WASM export normalization failed: " + message);
}

function readU32(bytes, cursor, limit) {
  let value = 0;
  let factor = 1;
  for (let i = 0; i < 5; i += 1) {
    if (cursor.offset >= limit) fail("unexpected end while reading a variable-length integer");
    const byte = bytes[cursor.offset++];
    value += (byte & 0x7f) * factor;
    if (value > 0xffffffff) fail("variable-length integer exceeds u32");
    if ((byte & 0x80) === 0) return value;
    factor *= 128;
  }
  fail("variable-length integer is longer than five bytes");
}

function encodeU32(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) {
    fail("cannot encode an invalid u32 value");
  }
  const output = [];
  let remaining = value;
  do {
    let byte = remaining % 128;
    remaining = Math.floor(remaining / 128);
    if (remaining > 0) byte |= 0x80;
    output.push(byte);
  } while (remaining > 0);
  return Buffer.from(output);
}

/**
 * Substrate pallet-contracts expects contract modules to export only the two
 * entry points it invokes: "deploy" and "call". Some Solang Polkadot builds
 * also export allocator helpers. Remove only those export-table entries:
 * function bodies, indices, imports, ABI selectors, and code bytes are not
 * changed. The caller must update any bundled source.wasm and code hash.
 */
function retainContractEntrypoints(input) {
  const bytes = Buffer.from(input);
  if (
    bytes.length < 8 ||
    bytes[0] !== 0x00 ||
    bytes[1] !== 0x61 ||
    bytes[2] !== 0x73 ||
    bytes[3] !== 0x6d ||
    bytes.readUInt32LE(4) !== 1
  ) {
    fail("input is not a WebAssembly v1 module");
  }

  const output = [bytes.subarray(0, 8)];
  const removed = [];
  let retained = [];
  let offset = 8;
  let sawExportSection = false;

  while (offset < bytes.length) {
    const sectionStart = offset;
    const sectionId = bytes[offset++];
    const cursor = { offset };
    const payloadSize = readU32(bytes, cursor, bytes.length);
    offset = cursor.offset;
    const payloadStart = offset;
    const payloadEnd = payloadStart + payloadSize;
    if (payloadEnd > bytes.length) fail("section payload extends past the end of the module");

    if (sectionId !== 7) {
      output.push(bytes.subarray(sectionStart, payloadEnd));
      offset = payloadEnd;
      continue;
    }

    if (sawExportSection) fail("module has more than one export section");
    sawExportSection = true;

    const exportCursor = { offset: payloadStart };
    const exportCount = readU32(bytes, exportCursor, payloadEnd);
    const keptEntries = [];
    const seen = new Set();
    const allNames = [];

    for (let i = 0; i < exportCount; i += 1) {
      const entryStart = exportCursor.offset;
      const nameLength = readU32(bytes, exportCursor, payloadEnd);
      const nameEnd = exportCursor.offset + nameLength;
      if (nameEnd + 1 > payloadEnd) fail("export name extends past the export section");
      const name = bytes.subarray(exportCursor.offset, nameEnd).toString("utf8");
      exportCursor.offset = nameEnd;
      const kind = bytes[exportCursor.offset++];
      readU32(bytes, exportCursor, payloadEnd); // export index; keep original encoded bytes
      const entryEnd = exportCursor.offset;

      allNames.push(name);
      if (CONTRACT_EXPORTS.has(name)) {
        if (kind !== 0) fail('entry point "' + name + '" is not a function export');
        if (seen.has(name)) fail('entry point "' + name + '" is exported more than once');
        seen.add(name);
        keptEntries.push(bytes.subarray(entryStart, entryEnd));
      } else {
        removed.push(name);
      }
    }

    if (exportCursor.offset !== payloadEnd) fail("unexpected trailing bytes in export section");
    for (const name of CONTRACT_EXPORTS) {
      if (!seen.has(name)) fail('required entry point "' + name + '" is missing');
    }

    retained = allNames.filter(name => CONTRACT_EXPORTS.has(name));
    const newPayload = Buffer.concat([encodeU32(keptEntries.length), ...keptEntries]);
    output.push(Buffer.concat([Buffer.from([sectionId]), encodeU32(newPayload.length), newPayload]));
    offset = payloadEnd;
  }

  if (!sawExportSection) fail("module has no export section");

  const wasm = Buffer.concat(output);
  const module = new WebAssembly.Module(wasm);
  const actual = WebAssembly.Module.exports(module);
  const actualNames = actual.map(entry => entry.name).sort();
  if (
    actualNames.length !== 2 ||
    actualNames[0] !== "call" ||
    actualNames[1] !== "deploy" ||
    actual.some(entry => entry.kind !== "function")
  ) {
    fail("normalized module does not expose exactly the deploy and call function exports");
  }

  return { wasm, removed, retained: ["deploy", "call"] };
}

module.exports = { retainContractEntrypoints };
