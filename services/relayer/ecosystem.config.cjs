// pm2 process config for the PASTX bridge relayer.
//
// Secrets are NOT stored here. Create services/relayer/.env (copy from
// .env.example) with PASTX_BNB_RELAYER_PRIVATE_KEY — that file is gitignored
// and loaded automatically by index.mjs.
//
// Usage on the VPS:
//   cd services/relayer
//   npm ci
//   cp .env.example .env   # then edit .env and set the relayer key
//   pm2 start ecosystem.config.cjs
//   pm2 save
module.exports = {
  apps: [
    {
      name: "pastx-relayer",
      script: "index.mjs",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 15,
      restart_delay: 5000,
      max_memory_restart: "200M",
      env: { NODE_ENV: "production" },
    },
  ],
};
