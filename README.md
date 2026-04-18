# Ethereum Killer NFT Marketplace

![Ethereum Killer NFT Marketplace](Ethereum%20Killer%20NFT%20Marketplace.png)

**Live:** [xdc.art](https://xdc.art)

10,000 unique NFTs with 25 unique backgrounds on XDC Network. Fully on-chain marketplace with red-black tree ordering and min-heap price tracking.

## Smart Contract Key Features

- **Fully on-chain marketplace** — No off-chain indexers or backend. All sorting, pagination, offers, and sales history live in the smart contract.
- **Red-black tree + min-heap** — O(log n) sorted queries and O(1) floor price, directly on-chain
- **Offer system** — Make, update, withdraw, and accept offers with automatic outbid refunds
- **Front-running protection** — Buyers pass expected price to prevent mempool price manipulation
- **On-chain pagination** — All queries support ascending/descending sort with pagination
- **Sales history** — Per-token and global sales history stored and queryable on-chain

## Deployed Contracts (XDC Mainnet)

| Contract | Address |
|----------|---------|
| EthereumKiller | [0x1343AD5D396438eE12a7E50b3927792Ea1e6b6Ab](https://xdcscan.com/address/0x1343AD5D396438eE12a7E50b3927792Ea1e6b6Ab) |
| OrderStatisticsTree | [0xF990007ee8b948284552d605d5e04BcC9b362960](https://xdcscan.com/address/0xF990007ee8b948284552d605d5e04BcC9b362960) |
| CustomMinHeapLib | [0xE2D37697E278f7d768b64187053dDc04a6ce3bC0](https://xdcscan.com/address/0xE2D37697E278f7d768b64187053dDc04a6ce3bC0) |
| OriginalNFT | [0xd6950d16402AEA3776881D3f72C13558444E8304](https://xdcscan.com/address/0xd6950d16402AEA3776881D3f72C13558444E8304) |
| OriginalNFTMarketplace | [0xc4454DdB6EE5E9e6d77DE3D7b2b90eAa4FD59bca](https://xdcscan.com/address/0xc4454DdB6EE5E9e6d77DE3D7b2b90eAa4FD59bca) |

## Prerequisites

- Node.js v18+
- npm

## Run a Local Copy

### 1. Install dependencies

```bash
npm install
cd NFT_site && npm install && cd ..
```

### 2. Set up environment

```bash
cp NFT_site/.env.example NFT_site/.env.local
```

The default `.env.local` sets `NEXT_PUBLIC_NETWORK=localhost` which connects the site to a local Hardhat node.

### 3. Start Hardhat node

```bash
npx hardhat node --no-deploy
```

Keep this terminal open.

### 4. Deploy contracts and mint NFTs

In a new terminal:

```bash
npx hardhat deploy --network localhost
```

This deploys all contracts and mints 10,000 NFTs. Takes a few minutes.

### 5. Start the site

In a new terminal:

```bash
cd NFT_site
npm run dev
```

Open http://localhost:3000 in your browser.

### 6. Connect a wallet

Import one of Hardhat's default accounts into MetaMask:

- Private key: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
- Network: `http://127.0.0.1:8545` (Chain ID: 1337)

This account is the deployer/owner of all 10,000 NFTs.

## Switch to Mainnet

Edit `NFT_site/.env.local`:

```
NEXT_PUBLIC_NETWORK=xdc
```

Restart the site. It will connect to XDC mainnet with the deployed contracts.

## Run Tests

```bash
# Hardhat tests (271 tests)
npx hardhat test

# Foundry fuzz tests (269 tests)
forge test

# Site unit tests (25 tests)
cd NFT_site && npx vitest run

# Site e2e tests (needs Hardhat node + deploy running)
cd NFT_site && npm run test:e2e

# Site e2e wallet tests (needs MetaMask/Synpress setup)
cd NFT_site && npm run test:e2e:wallet

# All site e2e tests
cd NFT_site && npm run test:e2e:all
```

## Project Structure

```
contracts/          Solidity contracts
deploy/             Hardhat deploy scripts
deployments/        Deployment artifacts (addresses, ABIs)
foundry-test/       Foundry fuzz tests
test/               Hardhat tests
scripts/            Utility scripts
NFT_site/           Next.js marketplace frontend
nfts/               NFT images and metadata
```
