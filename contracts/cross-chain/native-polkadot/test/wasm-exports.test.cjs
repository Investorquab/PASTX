"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { retainContractEntrypoints } = require("../scripts/wasm-exports.cjs");

function uleb(value) {
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

function section(id, payload) {
  return Buffer.concat([Buffer.from([id]), uleb(payload.length), payload]);
}

function exportEntry(name, kind, index) {
  const bytes = Buffer.from(name, "utf8");
  return Buffer.concat([uleb(bytes.length), bytes, Buffer.from([kind]), uleb(index)]);
}

function sampleModule() {
  const exportPayload = Buffer.concat([
    uleb(4),
    exportEntry("soroban_alloc", 0, 0),
    exportEntry("deploy", 0, 0),
    exportEntry("call", 0, 1),
    exportEntry("soroban_malloc", 0, 1)
  ]);
  return Buffer.concat([
    Buffer.from("0061736d01000000", "hex"),
    section(1, Buffer.from([1, 0x60, 0, 0])),
    section(3, Buffer.from([2, 0, 0])),
    section(7, exportPayload),
    section(10, Buffer.from([2, 2, 0, 0x0b, 2, 0, 0x0b]))
  ]);
}

test("normalizes a Polkadot contract to only deploy/call exports", () => {
  const input = sampleModule();
  const inputNames = WebAssembly.Module.exports(new WebAssembly.Module(input)).map(item => item.name);
  assert.deepEqual(inputNames, ["soroban_alloc", "deploy", "call", "soroban_malloc"]);

  const result = retainContractEntrypoints(input);
  const outputNames = WebAssembly.Module.exports(new WebAssembly.Module(result.wasm)).map(item => item.name);
  assert.deepEqual(outputNames, ["deploy", "call"]);
  assert.deepEqual(result.removed, ["soroban_alloc", "soroban_malloc"]);
  assert.deepEqual(result.retained, ["deploy", "call"]);
});

test("does not silently accept a module missing a required entry point", () => {
  const input = sampleModule();
  const { wasm } = retainContractEntrypoints(input);
  assert.equal(WebAssembly.Module.exports(new WebAssembly.Module(wasm)).length, 2);

  const invalid = Buffer.from("0061736d01000000", "hex");
  assert.throws(() => retainContractEntrypoints(invalid), /no export section/);
});

test("rejects malformed wasm instead of changing it", () => {
  assert.throws(() => retainContractEntrypoints(Buffer.from("not wasm")), /not a WebAssembly v1 module/);
});
