/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PASTX_NATIVE_WS_RPC_URL?: string;
  readonly VITE_PASTX_NATIVE_CONTRACT_ADDRESS?: string;
  readonly VITE_PASTX_NATIVE_EXPECTED_GENESIS_HASH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
