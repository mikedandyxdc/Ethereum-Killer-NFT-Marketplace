// Derives accounts from TEST_MNEMONIC_1 and TEST_MNEMONIC_2 using multiple paths
// Only prints public addresses — mnemonic stays local
require("dotenv").config();
const { ethers } = require("ethers");

const TARGET = "0xb3C7c1c14f83f57370fcE247Ec359BE8584C3902".toLowerCase();
const PATHS = [
  "m/44'/60'/0'/0",    // MetaMask / Ethereum standard (BIP44)
  "m/44'/550'/0'/0",   // XDC Network (coin type 550)
  "m/44'/60'/0'",      // Ledger Legacy
  "m/44'/550'/0'",     // XDCPay alternate
  "m/44'/550'/0'/1",   // XDCPay internal
  "m/44'/550'/1'/0",   // XDCPay second account branch
  "m/44'/550'/2'/0",   // XDCPay third
  "m/44'/550'/0'/0/0", // XDCPay nested
  "m/44'/60'/0'/1",    // Internal change chain
  "m/44'/0'/0'/0",     // Bitcoin path
  "m/44'/1'/0'/0",     // Bitcoin testnet
  "m/0'/0'/0'",        // Non-standard
  "m/44'/60'/1'/0",    // Second account branch
  "m/44'/60'/2'/0",    // Third account branch
  "m",                 // Root
];

const passphrase = process.env.TEST_PASSPHRASE;
console.log("Passphrase loaded:", passphrase ? "yes" : "no");

// Validate mnemonics
for (const key of ["TEST_MNEMONIC_1", "TEST_MNEMONIC_2"]) {
  const m = process.env[key];
  if (!m) continue;
  const words = m.trim().split(/\s+/);
  console.log(`${key}: ${words.length} words`);
  try {
    ethers.Mnemonic.fromPhrase(m.trim());
    console.log(`  Valid BIP39 mnemonic ✅`);
  } catch (e) {
    console.log(`  INVALID: ${e.message}`);
  }
}
const passphrases = passphrase ? ["", passphrase] : [""];

for (const key of ["TEST_MNEMONIC_1", "TEST_MNEMONIC_2"]) {
  const mnemonic = process.env[key];
  if (!mnemonic) {
    console.log(`${key}: not set`);
    continue;
  }
  for (const pp of passphrases) {
    console.log(`\n=== ${key} ${pp ? "(with passphrase)" : "(no passphrase)"} ===`);
    for (const basePath of PATHS) {
      let found = false;
      for (let i = 0; i < 50; i++) {
        const path = `${basePath}/${i}`;
        const wallet = ethers.HDNodeWallet.fromPhrase(mnemonic, pp, path);
        if (wallet.address.toLowerCase() === TARGET) {
          console.log(`  Path: ${basePath} Account ${i}: ${wallet.address} ✅ MATCH!`);
          found = true;
          break;
        }
      }
      if (found) break;
    }
    if (!passphrases.some(() => false)) console.log("  No match across all paths");
  }
}
