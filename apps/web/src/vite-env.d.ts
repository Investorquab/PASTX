/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PASTX_PORTALDOT_EVM_RPC_URL?: string;
  readonly VITE_PASTX_BSC_TESTNET_RPC_URL?: string;
  readonly VITE_PASTX_PORTALDOT_ESCROW_ADDRESS?: string;
  readonly VITE_PASTX_BNB_GATEWAY_ADDRESS?: string;
  readonly VITE_PASTX_PORTAL_TOKEN?: string;
  readonly VITE_PASTX_PORTAL_FAUCET?: string;
  readonly VITE_PASTX_PORTAL_ISWAP_ADDRESS?: string;
  readonly VITE_PASTX_BRIDGE_MAX_DEPOSIT_RAW?: string;
  readonly VITE_PASTX_SOURCE_VALUE_SEMANTICS_VERIFIED?: string;
  readonly VITE_PASTX_NATIVE_WS_RPC_URL?: string;
  readonly VITE_PASTX_NATIVE_CONTRACT_ADDRESS?: string;
  readonly VITE_PASTX_NATIVE_EXPECTED_GENESIS_HASH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
