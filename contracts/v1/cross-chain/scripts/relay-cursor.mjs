import { readFile, rename, writeFile } from "node:fs/promises";

export async function loadRelayCursors({ cursorPath, identity, portalStartBlock, bnbStartBlock }) {
  let saved;
  try {
    saved = JSON.parse(await readFile(cursorPath, "utf8"));
  } catch (error) {
    if (error && error.code === "ENOENT") return { portal: portalStartBlock, bnb: bnbStartBlock };
    throw new Error(`Unable to read relay cursor checkpoint ${cursorPath}: ${error.message}`);
  }

  if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
    throw new Error("Relay cursor checkpoint must contain a JSON object.");
  }
  for (const [key, expected] of Object.entries(identity)) {
    if (saved[key] !== expected) {
      throw new Error(`Relay cursor checkpoint identity mismatch for ${key}; do not reuse a cursor file across deployments or scan-start settings.`);
    }
  }
  if (!/^\d+$/.test(String(saved.nextPortalBlock)) || !/^\d+$/.test(String(saved.nextBnbBlock))) {
    throw new Error("Relay cursor checkpoint has invalid block cursors; inspect or restore it manually.");
  }

  const portal = BigInt(saved.nextPortalBlock);
  const bnb = BigInt(saved.nextBnbBlock);
  if (portal < portalStartBlock || bnb < bnbStartBlock) {
    throw new Error("Relay cursor checkpoint precedes a configured scan start block.");
  }
  return { portal, bnb };
}

export async function saveRelayCursors(cursorPath, identity, portalCursor, bnbCursor) {
  const saved = {
    ...identity,
    nextPortalBlock: portalCursor.toString(),
    nextBnbBlock: bnbCursor.toString(),
    updatedAt: new Date().toISOString()
  };
  const temporaryPath = `${cursorPath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(saved, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporaryPath, cursorPath);
}
