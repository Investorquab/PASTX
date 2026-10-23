import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadRelayCursors, saveRelayCursors } from "../scripts/relay-cursor.mjs";

const identity = {
  version: 1,
  portalChainId: 420420777,
  bnbChainId: 97,
  portalEscrowAddress: "0x1111111111111111111111111111111111111111",
  bnbGatewayAddress: "0x2222222222222222222222222222222222222222",
  portalStartBlock: "100",
  bnbStartBlock: "200"
};

async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pastx-relay-cursor-"));
  try { await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

test("starts from configured deployment blocks when no checkpoint exists", async () => {
  await withTempDir(async dir => {
    const cursors = await loadRelayCursors({
      cursorPath: path.join(dir, "cursor.json"), identity,
      portalStartBlock: 100n, bnbStartBlock: 200n
    });
    assert.deepEqual(cursors, { portal: 100n, bnb: 200n });
  });
});

test("persists and restores independent chain cursors", async () => {
  await withTempDir(async dir => {
    const cursorPath = path.join(dir, "cursor.json");
    await saveRelayCursors(cursorPath, identity, 135n, 289n);
    const cursors = await loadRelayCursors({
      cursorPath, identity, portalStartBlock: 100n, bnbStartBlock: 200n
    });
    assert.deepEqual(cursors, { portal: 135n, bnb: 289n });
    const saved = JSON.parse(await readFile(cursorPath, "utf8"));
    assert.equal(saved.nextPortalBlock, "135");
    assert.equal(saved.nextBnbBlock, "289");
    assert.equal(saved.portalEscrowAddress, identity.portalEscrowAddress);
  });
});

test("rejects checkpoints for another deployment or start-block configuration", async () => {
  await withTempDir(async dir => {
    const cursorPath = path.join(dir, "cursor.json");
    await saveRelayCursors(cursorPath, identity, 120n, 220n);
    await assert.rejects(loadRelayCursors({
      cursorPath, identity: { ...identity, bnbGatewayAddress: "0x3333333333333333333333333333333333333333" },
      portalStartBlock: 100n, bnbStartBlock: 200n
    }), /identity mismatch/);
  });
});

test("rejects malformed or backward cursors instead of silently skipping history", async () => {
  await withTempDir(async dir => {
    const cursorPath = path.join(dir, "cursor.json");
    await saveRelayCursors(cursorPath, identity, 120n, 220n);
    await writeFile(cursorPath, JSON.stringify({ ...identity, nextPortalBlock: "99", nextBnbBlock: "220" }));
    await assert.rejects(loadRelayCursors({
      cursorPath, identity, portalStartBlock: 100n, bnbStartBlock: 200n
    }), /precedes a configured scan start/);
    await writeFile(cursorPath, JSON.stringify({ ...identity, nextPortalBlock: "abc", nextBnbBlock: "220" }));
    await assert.rejects(loadRelayCursors({
      cursorPath, identity, portalStartBlock: 100n, bnbStartBlock: 200n
    }), /invalid block cursors/);
  });
});

test("fails closed on corrupt checkpoint JSON", async () => {
  await withTempDir(async dir => {
    const cursorPath = path.join(dir, "cursor.json");
    await writeFile(cursorPath, "{not-json");
    await assert.rejects(loadRelayCursors({
      cursorPath, identity, portalStartBlock: 100n, bnbStartBlock: 200n
    }), /Unable to read relay cursor checkpoint/);
  });
});
