const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// OriginalNFT is already deployed on XDC mainnet
const ORIGINAL_NFT_ADDRESS = "0xd6950d16402AEA3776881D3f72C13558444E8304";

module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy, getOrNull } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("🔸 Starting MAINNET deployment...");
  console.log("🔸 Deployer address:", deployer);

  try {
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

    // Skip OriginalNFT — already deployed on mainnet at ORIGINAL_NFT_ADDRESS

    // Deploy OriginalNFTMarketplace
    console.log("🔸 Deploying OriginalNFTMarketplace...");
    let originalMarketplaceDeployment = await getOrNull("OriginalNFTMarketplace");
    if (!originalMarketplaceDeployment) {
      originalMarketplaceDeployment = await deploy("OriginalNFTMarketplace", {
        from: deployer,
        args: [deployer, ORIGINAL_NFT_ADDRESS], // royaltyOwner, originalNFT
        log: true,
      });
      console.log("✅ OriginalNFTMarketplace deployed at:", originalMarketplaceDeployment.address);
    } else {
      console.log("✅ OriginalNFTMarketplace already deployed at:", originalMarketplaceDeployment.address);
    }

    // NOTE: Owner must manually call setApprovalForAll on OriginalNFT via the admin panel
    console.log("⚠️  REMINDER: Owner (0xb3C7c1c14f83f57370fcE247Ec359BE8584C3902) must call setApprovalForAll on OriginalNFT to approve the marketplace at:", originalMarketplaceDeployment.address);

    console.log("🔸 Contract deployment completed. Starting minting process...");

    // Get EthereumKiller contract instance
    const EthereumKiller = await ethers.getContractFactory("EthereumKiller", {
      libraries: {
        OrderStatisticsTree: orderStatisticsTreeDeployment.address,
        CustomMinHeapLib: customMinHeapLibDeployment.address,
      },
    });
    const xrc721 = await EthereumKiller.attach(xrc721Deployment.address);

    // Load metadata JSON
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

    // Check how many tokens already minted (for resume support)
    const totalMinted = await xrc721.getTokenCount();
    const startFrom = Number(totalMinted);
    const totalTokens = 10000;

    if (startFrom > 0) {
      console.log(`🔹 Resuming from token ${startFrom} (${startFrom} already minted)`);
    }

    // Mint and list tokens
    console.log("🔹 Starting to mint and list tokens...");
    let lastMintedToken = startFrom - 1;
    const logInterval = 100;

    for (let i = startFrom; i < totalTokens; i++) {
      try {
        const tokenId = i;
        const paddedId = String(tokenId).padStart(4, "0");
        const meta = tokenMetadata[paddedId];
        const uri = meta ? JSON.stringify(meta) : "";
        const price = tokenId % 400 === 0 ? ethers.parseEther("10000000") : ethers.parseEther("25000");

        // Manual gas limit to avoid RPC fee cap rejection (rpc.xinfin.network caps at 1 XDC)
        const tx = await xrc721.mintAndListForSale(deployer, tokenId, price, uri, { gasLimit: 10000000 });
        await tx.wait(); // Wait for confirmation on real network

        // Log every logInterval tokens
        if ((i + 1) % logInterval === 0 || i + 1 >= totalTokens) {
          console.log(`✅ Progress: ${i + 1}/${totalTokens} tokens minted`);
        }

        lastMintedToken = tokenId;
      } catch (error) {
        console.error(`❌ Error at token ${i}:`, error.message);
        console.log(`🔹 Last successfully minted token: ${lastMintedToken}`);
        console.log("🔹 Re-run this script to resume from where it stopped.");
        break;
      }
    }

    if (lastMintedToken === totalTokens - 1) {
      console.log("🎉 Finished minting and listing all 10,000 tokens!");
    }

    // Print summary
    console.log("\n📋 DEPLOYMENT SUMMARY:");
    console.log("========================");
    console.log("OrderStatisticsTree:", orderStatisticsTreeDeployment.address);
    console.log("CustomMinHeapLib:", customMinHeapLibDeployment.address);
    console.log("EthereumKiller:", xrc721Deployment.address);
    console.log("OriginalNFTMarketplace:", originalMarketplaceDeployment.address);
    console.log("OriginalNFT (existing):", ORIGINAL_NFT_ADDRESS);
    console.log("========================");
    console.log("⚠️  Update these addresses in lib/contract.js and lib/originalContract.js");

  } catch (error) {
    console.error("❌ An error occurred:", error);
  }

  console.log("✅ Mainnet deployment script completed.");
};

module.exports.tags = ["Mainnet"];

// Safety: only run on XDC mainnet (chainId 50)
module.exports.skip = async ({ getChainId }) => {
  const chainId = await getChainId();
  return chainId !== '50';
};
