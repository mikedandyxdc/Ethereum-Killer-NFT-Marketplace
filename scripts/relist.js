// Script 2: Run with NEW mnemonic in .env
// Re-lists all transferred NFTs at their original prices
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

process.on('uncaughtException', (err) => {
  console.log(`⚠️ Uncaught error: ${err.message} — will be handled by retry logic`);
});

async function main() {
  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();
  console.log("Signer (new wallet):", signerAddress);

  // Get contract instance
  const deployments = JSON.parse(fs.readFileSync(
    path.resolve(__dirname, "../deployments/xdc/EthereumKiller.json"), "utf8"
  ));
  const xrc721 = await ethers.getContractAt("EthereumKiller", deployments.address, signer);

  // Tokens 0-9150 were transferred (delisted), need relisting
  // Tokens 9151-9999 were minted via mintAndListForSale (already listed)
  const LAST_TRANSFERRED = 9151;

  // Resume support — check progress file
  const progressFile = path.resolve(__dirname, "../relist-progress.txt");
  let startFrom = 0;
  if (fs.existsSync(progressFile)) {
    startFrom = parseInt(fs.readFileSync(progressFile, "utf8").trim());
    console.log(`🔹 Resuming from token ${startFrom} (from progress file)`);
  }

  console.log(`\n🔸 Relisting tokens ${startFrom} to ${LAST_TRANSFERRED - 1}...`);

  let relisted = 0;
  for (let i = startFrom; i < LAST_TRANSFERRED; i++) {
    try {
      // Determine price (same logic as minting)
      const price = i % 400 === 0 ? ethers.parseEther("10000000") : ethers.parseEther("25000");

      // const tx = await xrc721.listTokenForSale(i, price, { gasLimit: 10000000 });
      const tx = await xrc721.listTokenForSale(i, price, { gasLimit: 5000000, gasPrice: 15000000000 });
      await tx.wait();
      relisted++;
      fs.writeFileSync(progressFile, String(i + 1));

      if (relisted % 100 === 0) {
        console.log(`✅ Relisted: ${relisted} tokens (at token ${i})`);
      }
    } catch (error) {
      // Auto-retry on connection reset
      const msg = error?.message || String(error);
      if (msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT') || msg.includes('network') || msg.includes('Timeout') || msg.includes('timeout') || msg.includes('already known') || msg.includes('nonce too low') || msg.includes('underpriced') || msg.includes('nonce')) {
        console.log(`⚠️ Connection error at token ${i}, retrying in 5s...`);
        await new Promise(r => setTimeout(r, 5000));
        i--;
        continue;
      }
      // Skip if already listed
      if (msg.includes('execution reverted') || msg.includes('CALL_EXCEPTION')) {
        console.log(`⚠️ Token ${i} reverted — skipping`);
        continue;
      }
      console.error(`❌ Error relisting token ${i}:`, msg);
      console.log(`🔹 Relisted ${relisted} so far. Re-run to resume.`);
      return;
    }
  }

  console.log(`\n🎉 DONE! Relisted ${relisted} tokens.`);
}

main().catch(console.error);
