'use strict';

const {
  connectAndPrepare, printReport, EXPECTED_ADDRESS, EXPECTED_GENESIS
} = require('./storage-deposit-common.cjs');

(async () => {
  let prepared;
  try {
    if (!process.argv.includes('--deploy')) {
      throw new Error('This command is dry-run by default. To submit the native deployment transaction, rerun explicitly with: node native-ink/scripts/deploy.cjs --deploy');
    }
    if (!EXPECTED_ADDRESS || !EXPECTED_GENESIS) {
      throw new Error('Deployment safety pins are missing. Set PORTALDOT_NATIVE_EXPECTED_ADDRESS to the confirmed 5... signer and PORTALDOT_NATIVE_EXPECTED_GENESIS_HASH to the genesis hash returned by preflight.');
    }
    prepared = await connectAndPrepare({ requirePinnedNetwork: true });
    printReport(prepared);
    if (!prepared.canAfford) throw new Error('Insufficient free balance after preserving PORTALDOT_NATIVE_KEEP_RESERVE. No transaction submitted.');

    console.log('\nSubmitting instantiateWithCode to the native contracts pallet...');
    let completed = false;
    let unsubscribe;
    let resolveResult;
    let rejectResult;
    const inclusion = new Promise((resolve, reject) => { resolveResult = resolve; rejectResult = reject; });
    prepared.tx.signAndSend(prepared.signer, (result) => {
      if (result.dispatchError) {
        completed = true;
        rejectResult(new Error(`Deployment extrinsic failed: ${require('./storage-deposit-common.cjs').decodeError(prepared.api, result.dispatchError)}`));
      } else if (result.status.isDropped || result.status.isInvalid || result.status.isUsurped) {
        completed = true;
        rejectResult(new Error(`Deployment extrinsic was not accepted: ${result.status.toString()}`));
      } else if (result.status.isFinalized) {
        completed = true;
        resolveResult(result);
      }
    }).then((unsub) => {
      unsubscribe = unsub;
      if (completed) unsubscribe();
    }).catch((error) => {
      completed = true;
      rejectResult(error);
    });

    const result = await inclusion;
    if (unsubscribe) unsubscribe();
    console.log(`\nDeployment transaction finalized: ${result.txHash.toHex()}`);
    console.log(`Finalized block: ${result.status.asFinalized.toHex()}`);
    let contractAddress = null;
    for (const record of result.events) {
      const { section, method, data } = record.event;
      if (section === 'contracts' && method === 'Instantiated') {
        contractAddress = data[1]?.toString() || data[0]?.toString() || null;
      }
    }
    if (contractAddress) console.log(`Native contract address: ${contractAddress}`);
    else console.log('Instantiation event not found in finalized events; inspect the explorer/events before retrying.');
    console.log('Save the transaction hash and contract address with the deployment records.');
  } catch (error) {
    console.error(`\nNATIVE INK DEPLOYMENT STOPPED: ${error.message}`);
    process.exitCode = 1;
  } finally {
    if (prepared?.api) await prepared.api.disconnect().catch(() => {});
  }
})();
