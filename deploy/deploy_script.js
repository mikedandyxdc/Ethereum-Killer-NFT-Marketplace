const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function increaseBalances() {
  const signers = await ethers.getSigners();
  console.log("🔹 Increasing balances for all Hardhat accounts...");
  
  for (const signer of signers) {
    const address = await signer.getAddress();
    await network.provider.send("hardhat_setBalance", [
      address,
      "0x3635C9ADC5DEA00000", // Equivalent to 1,000,000 ETH
    ]);
  }
  console.log("🔹 All balances updated successfully!");
}

module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy, getOrNull } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("🔸 Starting deployment process...");

  try {
    await increaseBalances();

    // Deploy OrderStatisticsTree
    console.log("🔸 Deploying OrderStatisticsTree...");
    let orderStatisticsTreeDeployment = await getOrNull("OrderStatisticsTree");
    if (!orderStatisticsTreeDeployment) {
      orderStatisticsTreeDeployment = await deploy("OrderStatisticsTree", {
        from: deployer,
        log: true,
      });
      console.log("✅ OrderStatisticsTree deployed at:", orderStatisticsTreeDeployment.address);
    } else {
      console.log("✅ OrderStatisticsTree already deployed at:", orderStatisticsTreeDeployment.address);
    }

    // Deploy CustomMinHeapLib
    console.log("🔸 Deploying CustomMinHeapLib...");
    let customMinHeapLibDeployment = await getOrNull("CustomMinHeapLib");
    if (!customMinHeapLibDeployment) {
      customMinHeapLibDeployment = await deploy("CustomMinHeapLib", {
        from: deployer,
        log: true,
      });
      console.log("✅ CustomMinHeapLib deployed at:", customMinHeapLibDeployment.address);
    } else {
      console.log("✅ CustomMinHeapLib already deployed at:", customMinHeapLibDeployment.address);
    }

    // Deploy EthereumKiller
    console.log("🔸 Deploying EthereumKiller...");
    let xrc721Deployment = await getOrNull("EthereumKiller");
    if (!xrc721Deployment) {
      xrc721Deployment = await deploy("EthereumKiller", {
        from: deployer,
        log: true,
        libraries: {
          OrderStatisticsTree: orderStatisticsTreeDeployment.address,
          CustomMinHeapLib: customMinHeapLibDeployment.address,
        },
      });
      console.log("✅ EthereumKiller deployed at:", xrc721Deployment.address);
    } else {
      console.log("✅ EthereumKiller already deployed at:", xrc721Deployment.address);
    }

    // Deploy OriginalNFT (local dummy for testing)
    console.log("🔸 Deploying OriginalNFT...");
    let originalNFTDeployment = await getOrNull("OriginalNFT");
    if (!originalNFTDeployment) {
      originalNFTDeployment = await deploy("OriginalNFT", {
        from: deployer,
        log: true,
      });
      console.log("✅ OriginalNFT deployed at:", originalNFTDeployment.address);
    } else {
      console.log("✅ OriginalNFT already deployed at:", originalNFTDeployment.address);
    }

    // Deploy OriginalNFTMarketplace
    console.log("🔸 Deploying OriginalNFTMarketplace...");
    let originalMarketplaceDeployment = await getOrNull("OriginalNFTMarketplace");
    if (!originalMarketplaceDeployment) {
      originalMarketplaceDeployment = await deploy("OriginalNFTMarketplace", {
        from: deployer,
        // args: [deployer], // royaltyOwner = deployer for testing
        args: [deployer, originalNFTDeployment.address], // royaltyOwner, originalNFT
        log: true,
      });
      console.log("✅ OriginalNFTMarketplace deployed at:", originalMarketplaceDeployment.address);
    } else {
      console.log("✅ OriginalNFTMarketplace already deployed at:", originalMarketplaceDeployment.address);
    }

    // Wire up: approve marketplace as operator (setOriginalNFT no longer needed — immutable in constructor)
    // const OriginalNFTMarketplace = await ethers.getContractFactory("OriginalNFTMarketplace");
    // const originalMarketplace = await OriginalNFTMarketplace.attach(originalMarketplaceDeployment.address);
    // await originalMarketplace.setOriginalNFT(originalNFTDeployment.address);
    // console.log("✅ OriginalNFTMarketplace.setOriginalNFT set to:", originalNFTDeployment.address);

    const OriginalNFT = await ethers.getContractFactory("OriginalNFT");
    const originalNFT = await OriginalNFT.attach(originalNFTDeployment.address);
    // OriginalNFT owner is hardcoded in the contract — impersonate them for local testing
    const originalOwner = await originalNFT.ownerOf(1);
    await network.provider.send("hardhat_setBalance", [originalOwner, "0x3635C9ADC5DEA00000"]);
    await network.provider.send("hardhat_impersonateAccount", [originalOwner]);
    const ownerSigner = await ethers.getSigner(originalOwner);
    await originalNFT.connect(ownerSigner).setApprovalForAll(originalMarketplaceDeployment.address, true);
    await network.provider.send("hardhat_stopImpersonatingAccount", [originalOwner]);
    console.log("✅ OriginalNFT owner approved OriginalNFTMarketplace as operator");

    console.log("🔸 Deployment completed. Starting minting process...");

    // Get EthereumKiller contract instance
    const EthereumKiller = await ethers.getContractFactory("EthereumKiller", {
      libraries: {
        OrderStatisticsTree: orderStatisticsTreeDeployment.address,
        CustomMinHeapLib: customMinHeapLibDeployment.address,
      },
    });
    const xrc721 = await EthereumKiller.attach(xrc721Deployment.address);

    // Load metadata JSON — flatten from { b1: { "0000": {...} }, b2: {...} } to { "0000": {...}, "0001": {...}, ... }
    console.log("🔹 Loading metadata from master_metadata.json...");
    const metadataPath = path.resolve(__dirname, "../nfts/master_metadata.json");
    const rawMetadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
    const tokenMetadata = {};
    for (const bg of Object.values(rawMetadata)) {
      for (const [tokenKey, meta] of Object.entries(bg)) {
        tokenMetadata[tokenKey] = meta;
      }
    }
    console.log(`✅ Loaded metadata for ${Object.keys(tokenMetadata).length} tokens`);

    // Mint and list tokens with reduced logging
    console.log("🔹 Starting to mint and list tokens...");
    const batchSize = 1;
    let lastMintedToken = -1;
    const totalTokens = 10000;
    const logInterval = 1000;

    for (let i = 0; i < totalTokens; i += batchSize) {
      try {
        const batch = [];
        for (let j = 0; j < batchSize && i + j < totalTokens; j++) {
          const tokenId = i + j;
          const paddedId = String(tokenId).padStart(4, "0");
          const meta = tokenMetadata[paddedId];
          const uri = meta ? JSON.stringify(meta) : "";
          // const price = tokenId % 400 === 0 ? ethers.parseEther("10") : ethers.parseEther("1");
          const price = tokenId % 400 === 0 ? ethers.parseEther("10000000") : ethers.parseEther("25000");
          batch.push(xrc721.mintAndListForSale(deployer, tokenId, price, uri));
        }
        await Promise.all(batch);
        
        // Only log every logInterval tokens
        if ((i + batchSize) % logInterval === 0 || i + batchSize >= totalTokens) {
          console.log(`✅ Progress: ${Math.min(i + batchSize, totalTokens)}/${totalTokens} tokens processed`);
        }
        
        lastMintedToken = Math.min(i + batchSize - 1, totalTokens - 1);
      } catch (error) {
        console.error(`❌ Error occurred at token ${i}:`, error);
        console.log(`🔹 Last successfully minted token: ${lastMintedToken}`);
        console.log("🔹 Exiting minting process due to error.");
        break;
      }
    }

    if (lastMintedToken === totalTokens - 1) {
      console.log("🎉 Finished minting and listing all tokens successfully!");
    } else {
      console.log(`🔹 Minting process stopped at token ${lastMintedToken}`);
    }
  } catch (error) {
    console.error("❌ An error occurred during deployment or minting:", error);
  }

  console.log("✅ Deployment script completed.");
};

module.exports.tags = ["OrderStatisticsTree", "EthereumKiller", "OriginalNFT", "OriginalNFTMarketplace", "MintAndList"];

// Safety: only run on local networks (Hardhat/localhost)
module.exports.skip = async ({ getChainId }) => {
  const chainId = await getChainId();
  return chainId !== '1337' && chainId !== '31337';
};