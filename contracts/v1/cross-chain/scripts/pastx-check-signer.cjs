require("dotenv").config();
const { ethers } = require("ethers");

const path = "m/44'/60'/0'/0/0";
const pk = (process.env.PORTALDOT_DEPLOYER_PRIVATE_KEY || "").trim();
const phrase = (process.env.PORTALDOT_DEPLOYER_MNEMONIC || "")
  .trim().split(/\s+/).filter(Boolean).join(" ");

if (Boolean(pk) === Boolean(phrase)) {
  throw new Error("Expected exactly one signer source in .env");
}

const wallet = pk
  ? new ethers.Wallet(pk)
  : ethers.HDNodeWallet.fromPhrase(phrase, "", path);

console.log("Derivation path:", pk ? "private key (path not applicable)" : path);
console.log("Configured EVM address:", wallet.address);
console.log("Expected current address: 0x0e9e6054e743E881E4E593f92c9d998eD3057a60");
console.log(
  "Address matches:",
  wallet.address.toLowerCase() ===
    "0x0e9e6054e743E881E4E593f92c9d998eD3057a60".toLowerCase()
);
