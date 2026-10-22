'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

function requirePolkadotModule(name) {
  const localPath = path.resolve(process.cwd(), 'native-polkadot', 'node_modules', name);
  try {
    return require(localPath);
  } catch (localError) {
    try {
      return require(name);
    } catch {
      throw new Error(`Missing ${name}. Run: npm --prefix native-polkadot install --no-audit --no-fund --no-package-lock\n${localError.message}`);
    }
  }
}

const { ApiPromise, WsProvider } = requirePolkadotModule('@polkadot/api');
const { Keyring } = requirePolkadotModule('@polkadot/keyring');
const { cryptoWaitReady } = requirePolkadotModule('@polkadot/util-crypto');

const WS_URL = (process.env.PORTALDOT_NATIVE_WS_RPC_URL || 'wss://test-node-v3.portaldot.dev').trim();
const EXPECTED_CHAIN = (process.env.PORTALDOT_NATIVE_EXPECTED_CHAIN || '').trim();
const EXPECTED_ADDRESS = (process.env.PORTALDOT_NATIVE_EXPECTED_ADDRESS || '').trim();
const EXPECTED_GENESIS = (process.env.PORTALDOT_NATIVE_EXPECTED_GENESIS_HASH || '').trim();
const MNEMONIC = (process.env.PORTALDOT_DEPLOYER_MNEMONIC || process.env.PORTALDOT_NATIVE_MNEMONIC || '').trim();
const KEEP_RESERVE_TPOT = (process.env.PORTALDOT_NATIVE_KEEP_RESERVE || '1').trim();
const TOKEN_DECIMALS = 14;
const UNIT = 10n ** BigInt(TOKEN_DECIMALS);

function parseTpot(value, label = 'amount') {
  const s = String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,14})?$/.test(s)) {
    throw new Error(`${label} must be a non-negative tPOT amount with at most 14 decimal places; got ${JSON.stringify(s)}`);
  }
  const [whole, fraction = ''] = s.split('.');
  return BigInt(whole) * UNIT + BigInt((fraction + '0'.repeat(TOKEN_DECIMALS)).slice(0, TOKEN_DECIMALS));
}

function fmtTpot(raw) {
  const n = BigInt(raw);
  const whole = n / UNIT;
  const frac = (n % UNIT).toString().padStart(TOKEN_DECIMALS, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : `${whole}`;
}

function normalizeName(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function decodeError(api, error) {
  if (!error) return 'Unknown dispatch error';
  if (error.isModule) {
    const decoded = api.registry.findMetaError(error.asModule);
    return `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`;
  }
  return error.toString();
}

function jsonValue(codec) {
  if (codec && typeof codec.toJSON === 'function') return codec.toJSON();
  return codec;
}

function findNumericLeaf(value) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (normalizeName(key) === 'charge') {
        const parsed = findNumericLeaf(item);
        if (parsed !== null) return parsed;
      }
    }
  }
  return null;
}

function storageDepositCharge(codec) {
  if (codec && codec.isCharge && codec.asCharge !== undefined) return BigInt(codec.asCharge.toString());
  if (codec && codec.isRefund) return 0n;
  const json = jsonValue(codec);
  if (json && typeof json === 'object') {
    for (const [key, value] of Object.entries(json)) {
      const normalized = normalizeName(key);
      if (normalized === 'refund') return 0n;
      if (normalized === 'charge') {
        const parsed = findNumericLeaf(value);
        if (parsed !== null) return parsed;
      }
    }
  }
  const found = findNumericLeaf(json);
  if (found !== null && typeof json !== 'object') return found;
  throw new Error(`Could not safely interpret the runtime's storageDeposit value: ${JSON.stringify(json)}`);
}

function getGasLimit(api, dryRunResult) {
  const source = dryRunResult.gasRequired || dryRunResult.gasConsumed;
  if (!source) throw new Error('Runtime dry-run returned neither gasRequired nor gasConsumed; refusing to guess a deployment gas limit.');
  const j = jsonValue(source);
  const refTimeRaw = j.refTime ?? j.ref_time ?? j.refTimePerSecond;
  const proofSizeRaw = j.proofSize ?? j.proof_size;
  if (refTimeRaw === undefined || proofSizeRaw === undefined) {
    throw new Error(`Unrecognized runtime Weight format: ${JSON.stringify(j)}`);
  }
  let refTime = BigInt(refTimeRaw.toString());
  let proofSize = BigInt(proofSizeRaw.toString());
  // Add 25% headroom so a small runtime variation does not exhaust the gas cap.
  refTime = (refTime * 125n + 99n) / 100n;
  proofSize = (proofSize * 125n + 99n) / 100n;
  const blockMax = api.consts.system?.blockWeights?.maxBlock;
  if (blockMax) {
    const max = jsonValue(blockMax);
    const maxRef = BigInt((max.refTime ?? max.ref_time).toString());
    const maxProof = BigInt((max.proofSize ?? max.proof_size).toString());
    if (refTime > maxRef) refTime = maxRef;
    if (proofSize > maxProof) proofSize = maxProof;
  }
  return api.createType('WeightV2', { refTime: refTime.toString(), proofSize: proofSize.toString() });
}

function storageDepositLimitFor(charge) {
  // The limit is a ceiling, not the amount spent. Leave 25% headroom plus 0.1 tPOT
  // so exact-edge estimates do not fail with StorageDepositLimitExhausted.
  return (BigInt(charge) * 125n + 99n) / 100n + UNIT / 10n;
}

function weightForInitialDryRun(api) {
  const blockMax = api.consts.system?.blockWeights?.maxBlock;
  if (blockMax) return blockMax;
  // Fail-safe fallback for older runtimes which omit this constant.
  return api.createType('WeightV2', { refTime: '1000000000000', proofSize: '10000000' });
}

function buildArgs(meta, context) {
  return meta.args.map((arg) => {
    const rawName = arg.name?.toString?.() ?? String(arg.name ?? '');
    const name = normalizeName(rawName);
    if (name === 'origin' || name === 'caller') return context.signer.address;
    if (name === 'value' || name === 'transferredvalue') return '0';
    if (name === 'gaslimit' || name === 'weightlimit') return context.gasLimit;
    if (name === 'storagedepositlimit') return context.storageDepositLimit;
    if (name === 'code' || name === 'codebytes') {
      // The ContractsApi runtime dry-run expects Code<Hash>, whose Upload
      // variant carries new Wasm bytes. The contracts pallet extrinsic below
      // expects raw Bytes, so keep those two encodings distinct.
      return context.kind === 'dry-run' ? { Upload: context.wasm } : context.wasm;
    }
    if (name === 'data' || name === 'inputdata' || name === 'input') return context.constructorData;
    if (name === 'salt') return context.salt;
    if (name === 'determinism') return 'Enforced';
    throw new Error(`Unknown ${context.kind} argument "${rawName}". Refusing to guess its value.`);
  });
}

async function connectAndPrepare({ requirePinnedNetwork = false } = {}) {
  if (!MNEMONIC) throw new Error('PORTALDOT_DEPLOYER_MNEMONIC is missing from the local .env. Do not paste it into chat.');
  await cryptoWaitReady();
  const keyring = new Keyring({ type: 'sr25519', ss58Format: 42 });
  const signer = keyring.addFromUri(MNEMONIC);
  if (!signer.address.startsWith('5')) {
    throw new Error(`Native signer derived ${signer.address}, which does not look like the agreed 5... Substrate address. Stop; do not fund or deploy from this account.`);
  }
  if (EXPECTED_ADDRESS && signer.address !== EXPECTED_ADDRESS) {
    throw new Error(`Native signer mismatch: .env expected ${EXPECTED_ADDRESS}, but mnemonic derives ${signer.address}. No transaction submitted.`);
  }
  if (requirePinnedNetwork && !EXPECTED_ADDRESS) {
    throw new Error('Set PORTALDOT_NATIVE_EXPECTED_ADDRESS to your already-confirmed 5... address before deploying.');
  }
  if (requirePinnedNetwork && !EXPECTED_GENESIS) {
    throw new Error('Set PORTALDOT_NATIVE_EXPECTED_GENESIS_HASH to the genesis hash checked during preflight before deploying.');
  }

  const provider = new WsProvider(WS_URL);
  const api = await ApiPromise.create({ provider });
  try {
    const [chainName, genesisHash] = await Promise.all([api.rpc.system.chain(), api.rpc.chain.getBlockHash(0)]);
    const chainText = chainName.toString();
    const genesisText = genesisHash.toHex();
    if (EXPECTED_CHAIN && !chainText.toLowerCase().includes(EXPECTED_CHAIN.toLowerCase()) && !EXPECTED_CHAIN.toLowerCase().includes(chainText.toLowerCase())) {
      throw new Error(`Native chain mismatch: expected label containing ${JSON.stringify(EXPECTED_CHAIN)}, connected to ${JSON.stringify(chainText)}. No transaction submitted.`);
    }
    if (EXPECTED_GENESIS && genesisText.toLowerCase() !== EXPECTED_GENESIS.toLowerCase()) {
      throw new Error(`Native genesis hash mismatch: .env has ${EXPECTED_GENESIS}, live node reports ${genesisText}. No transaction submitted.`);
    }

    const artifactPath = path.resolve(process.cwd(), 'native-ink', 'target', 'ink', 'pastx_budget_market.contract');
    if (!fs.existsSync(artifactPath)) throw new Error(`Compiled ink! artifact not found: ${artifactPath}. Build the native-ink contract first.`);
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    const wasm = artifact.source?.wasm;
    if (typeof wasm !== 'string' || !/^0x(?:[0-9a-fA-F]{2})+$/.test(wasm) || !wasm.startsWith('0x0061736d')) {
      throw new Error('Artifact does not contain valid WebAssembly bytecode.');
    }

    // Never quote or deploy a mixed set of files from different workflow builds.
    // The read-only runtime quote is only meaningful for the exact WASM that will
    // be submitted, and the standalone ABI must describe the same contract.
    const artifactDir = path.dirname(artifactPath);
    const standaloneWasmPath = path.join(artifactDir, 'pastx_budget_market.wasm');
    const standaloneMetadataPath = path.join(artifactDir, 'pastx_budget_market.json');
    if (!fs.existsSync(standaloneWasmPath) || !fs.existsSync(standaloneMetadataPath)) {
      throw new Error(
        'The compact ink! artifact set is incomplete. Extract all three files (.contract, .wasm, .json) ' +
        'from the same successful PASTX Compact Native Market Contract Bundle workflow run into ' +
        artifactDir + '. No transaction submitted.'
      );
    }
    const standaloneWasm = fs.readFileSync(standaloneWasmPath);
    const embeddedWasm = Buffer.from(wasm.slice(2), 'hex');
    if (!standaloneWasm.equals(embeddedWasm)) {
      throw new Error(
        'Stale/mixed native ink! artifacts: the WASM embedded in .contract does not match ' +
        'pastx_budget_market.wasm. Download and extract all three files from the same successful workflow run. ' +
        'No transaction submitted.'
      );
    }
    let standaloneMetadata;
    try {
      standaloneMetadata = JSON.parse(fs.readFileSync(standaloneMetadataPath, 'utf8'));
    } catch (error) {
      throw new Error('Invalid standalone native ink! ABI metadata: ' + error.message + '. No transaction submitted.');
    }
    if (
      standaloneMetadata.source?.hash !== artifact.source?.hash ||
      standaloneMetadata.contract?.name !== artifact.contract?.name
    ) {
      throw new Error(
        'Stale/mixed native ink! artifacts: standalone ABI metadata and .contract are from different builds. ' +
        'Download and extract all three files from the same successful workflow run. No transaction submitted.'
      );
    }
    const constructor = (artifact.spec?.constructors || []).find((item) => item.label === 'new') || (artifact.spec?.constructors || []).find((item) => item.default);
    if (!constructor?.selector) throw new Error('Artifact has no readable default/new constructor selector.');

    // The dry-run is a runtime API call, not an RPC namespace method and not
    // the extrinsic. ContractsApi exposes `instantiate` with Code::Upload;
    // the broadcastable extrinsic remains api.tx.contracts.instantiateWithCode.
    const contractsRuntimeApi = api.call.contractsApi;
    const dryRunMethod = contractsRuntimeApi?.instantiate;
    if (typeof dryRunMethod !== 'function') {
      const runtimeNamespaces = Object.keys(api.call || {}).filter((name) => /contract|revive/i.test(name));
      const runtimeMethods = contractsRuntimeApi
        ? Object.keys(contractsRuntimeApi).filter((name) => /instantiate|upload|call/i.test(name))
        : [];
      const palletMethods = api.tx.contracts
        ? Object.keys(api.tx.contracts).filter((name) => /instantiate|upload/i.test(name))
        : [];
      throw new Error(
        `This node does not expose api.call.contractsApi.instantiate. ` +
        `Related runtime API namespaces: ${runtimeNamespaces.join(', ') || '(none)'}. ` +
        `ContractsApi methods: ${runtimeMethods.join(', ') || '(none)'}. ` +
        `Contracts extrinsics: ${palletMethods.join(', ') || '(none)'}. ` +
        `The native deployment path is not verified on this runtime; no transaction submitted.`
      );
    }
    const constructorData = constructor.selector;
    // Crucial fix: use no storage-deposit ceiling for the *read-only simulation*.
    // We then read the runtime's actual required deposit and set a calculated, bounded ceiling for deployment.
    // Runtime API decorators in some Polkadot.js/runtime-metadata combinations do
    // not expose method.meta.args even when the method itself is available. Avoid
    // depending on that optional decorator property: ContractsApi.instantiate has
    // this stable runtime-API order (origin, value, gas_limit,
    // storage_deposit_limit, code, data, salt).
    const initialGasLimit = weightForInitialDryRun(api);
    let dryRun;
    try {
      dryRun = await dryRunMethod(
        signer.address,
        '0',
        initialGasLimit,
        null,
        { Upload: wasm },
        constructorData,
        '0x'
      );
    } catch (error) {
      throw new Error(
        `ContractsApi.instantiate dry-run call failed: ${error?.message || String(error)}. ` +
        'No transaction submitted.'
      );
    }
    if (dryRun.result?.isErr) {
      throw new Error(`Native contract constructor dry-run failed: ${decodeError(api, dryRun.result.asErr)}. No transaction submitted.`);
    }
    const requiredStorageDeposit = storageDepositCharge(dryRun.storageDeposit);
    if (requiredStorageDeposit <= 0n) {
      throw new Error(`Runtime returned a zero/unrecognized storage deposit for instantiateWithCode; refusing to guess. Value: ${JSON.stringify(jsonValue(dryRun.storageDeposit))}`);
    }
    const gasLimit = getGasLimit(api, dryRun);
    const storageDepositLimit = storageDepositLimitFor(requiredStorageDeposit);
    const txMethod = api.tx.contracts?.instantiateWithCode;
    if (!txMethod) throw new Error('This runtime has no contracts.instantiateWithCode extrinsic. No transaction submitted.');

    const salt = `0x${crypto.randomBytes(16).toString('hex')}`;
    const txArgs = buildArgs(txMethod.meta, {
      kind: 'extrinsic', signer, wasm, constructorData, salt,
      gasLimit, storageDepositLimit: storageDepositLimit.toString()
    });
    const tx = txMethod(...txArgs);
    const [accountInfo, feeInfo] = await Promise.all([api.query.system.account(signer.address), tx.paymentInfo(signer)]);
    const free = BigInt(accountInfo.data.free.toString());
    const reserved = BigInt(accountInfo.data.reserved.toString());
    const keepReserve = parseTpot(KEEP_RESERVE_TPOT, 'PORTALDOT_NATIVE_KEEP_RESERVE');
    const fee = BigInt(feeInfo.partialFee.toString());
    const minimumRequired = requiredStorageDeposit + fee + keepReserve;
    const canAfford = free >= minimumRequired;

    return {
      api, signer, chainText, genesisText, artifact, artifactPath, wasm, constructorData,
      salt, dryRun, requiredStorageDeposit, storageDepositLimit, gasLimit, tx,
      free, reserved, keepReserve, fee, minimumRequired, canAfford,
      status: {
        rpc: WS_URL,
        chain: chainText,
        genesisHash: genesisText,
        address: signer.address,
        wasmBytes: (wasm.length - 2) / 2,
        contract: artifact.contract?.name || 'unknown'
      }
    };
  } catch (error) {
    await api.disconnect().catch(() => {});
    throw error;
  }
}

function printReport(p) {
  console.log('\nPASTX native ink! storage-deposit preflight (read-only)');
  console.log('----------------------------------------------------');
  console.log(`Network:              ${p.status.chain}`);
  console.log(`WebSocket RPC:        ${p.status.rpc}`);
  console.log(`Genesis hash:         ${p.status.genesisHash}`);
  console.log(`Native signer:        ${p.status.address}`);
  console.log(`Contract artifact:    ${p.status.contract}`);
  console.log(`WASM size:            ${p.status.wasmBytes.toLocaleString()} bytes`);
  console.log(`Free balance:         ${fmtTpot(p.free)} tPOT`);
  console.log(`Already reserved:     ${fmtTpot(p.reserved)} tPOT`);
  console.log(`Storage deposit need: ${fmtTpot(p.requiredStorageDeposit)} tPOT`);
  console.log(`Storage-deposit cap:  ${fmtTpot(p.storageDepositLimit)} tPOT (limit only; not the amount automatically spent)`);
  console.log(`Estimated tx fee:     ${fmtTpot(p.fee)} tPOT`);
  console.log(`Keep-reserve floor:   ${fmtTpot(p.keepReserve)} tPOT`);
  console.log(`Balance needed:       ${fmtTpot(p.minimumRequired)} tPOT including reserve`);
  console.log(`Balance check:        ${p.canAfford ? 'PASS' : 'FAIL — insufficient free balance for deposit + fee + reserve'}`);
  if (!EXPECTED_ADDRESS) console.log('Account pin:          NOT SET — set PORTALDOT_NATIVE_EXPECTED_ADDRESS to your confirmed 5... address before deployment.');
  if (!EXPECTED_GENESIS) console.log('Network pin:          NOT SET — copy the verified genesis hash into PORTALDOT_NATIVE_EXPECTED_GENESIS_HASH before deployment.');
  console.log('\nNo transaction was submitted by this preflight.');
}

module.exports = {
  connectAndPrepare, printReport, fmtTpot, parseTpot, storageDepositCharge,
  storageDepositLimitFor, decodeError, EXPECTED_ADDRESS, EXPECTED_GENESIS
};
