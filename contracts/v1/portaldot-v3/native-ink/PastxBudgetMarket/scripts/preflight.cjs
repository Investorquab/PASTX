'use strict';

const { connectAndPrepare, printReport } = require('./storage-deposit-common.cjs');

(async () => {
  let prepared;
  try {
    prepared = await connectAndPrepare();
    printReport(prepared);
    if (!prepared.canAfford) process.exitCode = 2;
  } catch (error) {
    console.error(`\nNATIVE INK PREFLIGHT BLOCKED: ${error.message}`);
    console.error('No transaction was submitted.');
    process.exitCode = 1;
  } finally {
    if (prepared?.api) await prepared.api.disconnect().catch(() => {});
  }
})();
