# Ethereum Killer NFT Marketplace — Site Plan

## Tech Stack
- **Framework**: Next.js 14 (React 18, App Router)
- **Web3**: Wagmi v2 + Viem (contract interaction, hooks-based, multicall for batch reads)
- **Wallet UI**: RainbowKit (connect wallet modal, network switching, account display)
- **Styling**: Tailwind CSS (dark theme)
- **Notifications**: Sonner (toast notifications for tx status)
- **State**: Wagmi hooks + React Context (no Redux needed)
- **Testing**: Synpress (Playwright + MetaMask automation)
- **Build/Deploy**: Next.js (built-in)

## Folder Structure
```
NFT_site/
├── public/
│   └── favicon.ico
├── app/
│   ├── layout.jsx                # Root layout (Navbar, Footer, Providers)
│   ├── page.jsx                  # Home page (landing + stats)
│   ├── providers.jsx             # WagmiConfig + RainbowKit + QueryClient
│   ├── browse/
│   │   └── page.jsx              # Browse page (for-sale/not-for-sale grids)
│   ├── token/
│   │   └── [id]/
│   │       └── page.jsx          # Token Detail page (single NFT)
│   ├── profile/
│   │   ├── page.jsx              # My profile (redirects to connected wallet)
│   │   └── [address]/
│   │       └── page.jsx          # Profile page (any wallet's NFTs + offers)
│   ├── activity/
│   │   └── page.jsx              # Activity page (global feeds)
│   └── admin/
│       └── page.jsx              # Admin page (owner controls)
├── components/
│   ├── layout/
│   │   ├── Navbar.jsx            # Navigation + Search bar + RainbowKit ConnectButton
│   │   └── Footer.jsx            # Links, socials
│   ├── nft/
│   │   ├── NFTCard.jsx           # Grid card (image, price, name)
│   │   ├── NFTGrid.jsx           # Grid container with pagination
│   │   └── TraitFilter.jsx       # Checkbox trait filtering
│   ├── token/
│   │   ├── BuyButton.jsx         # Buy action
│   │   ├── ListingActions.jsx    # List/delist/update price
│   │   ├── OfferActions.jsx      # Make/update/withdraw offer
│   │   ├── AcceptOffer.jsx       # Accept offer (owner view)
│   │   ├── OffersList.jsx        # Offers table with pagination
│   │   ├── SalesHistory.jsx      # Sales history table
│   │   ├── TraitsDisplay.jsx     # Trait badges
│   │   └── TransferModal.jsx     # Transfer/approve actions
│   ├── activity/
│   │   ├── SalesFeed.jsx         # Global sales list
│   │   └── OffersFeed.jsx        # Global offers list
│   └── ui/
│       ├── Pagination.jsx        # Reusable pagination controls
│       ├── SortToggle.jsx        # Asc/desc toggle
│       └── Modal.jsx             # Reusable modal
├── lib/
│   ├── contract.js               # Contract address, ABI, config
│   ├── abi.json                  # XRC721 ABI (extracted from build)
│   └── chains.js                 # Custom chain config (XDC)
├── hooks/
│   ├── useContract.js            # Contract read/write helpers
│   └── usePagination.js          # Reusable pagination logic
├── utils/
│   ├── format.js                 # Format ETH, addresses, dates
│   └── metadata.js               # Parse metadata JSON, trait extraction
├── tests/
│   └── e2e/
│       ├── setup.js              # Synpress config, wallet setup
│       ├── home.spec.js          # Home page tests
│       ├── browse.spec.js        # Browse + filtering tests
│       ├── buy.spec.js           # Buy flow tests
│       ├── offer.spec.js         # Offer flow tests
│       ├── listing.spec.js       # List/delist/update tests
│       ├── profile.spec.js       # Profile page tests
│       └── multiuser.spec.js     # Multi-wallet marketplace simulation
├── package.json
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
└── SITE_PLAN.md
```

## Global — Navbar Search
**Search bar in Navbar (always visible on every page):**
- Single input field: accepts token ID or wallet address
- Token ID (number) → navigates to `/token/[id]`
- Wallet address (0x...) → navigates to `/profile/[address]`
- Validates token ID exists (0-9999) before navigating

## Pages — Feature Mapping

### 1. Home
**Contract calls:**
- `name()`, `symbol()`, `description`, `x`, `website`
- `ethereumLicense`, `xdcLicense`, `xdc_will_kill_ethereum_xdc_is_the_real_ethereum_killer`
- `getTokenCount()`, `getOwnerCount()`, `getFloorPrice()`, `getTotalSalesCount()`, `totalVolume`
- `MAX_TOKEN_SUPPLY`, `ROYALTY_FRACTION`

**UI:**
- Hero banner image (`nfts/banner`) with collection name + description
- Stats bar: floor price, volume, minted, owners, sales (XDC + USD conversion)
- Featured NFTs grid (first few for-sale tokens)
- Social links (x.com, website)

### 2. Browse
**Data loading strategy (on first visit, cached):**
- `master_metadata.json` — static file served with site (all 10k tokens: names, traits, images)
- `getForSaleTokens()` — batch-load all for-sale token IDs (paginated calls if needed)
- `getNotForSaleTokens()` — batch-load all not-for-sale token IDs
- `getTokenPrice()` — Viem multicall to fetch all for-sale prices in one RPC request
- Total: ~3-5 RPC calls instead of thousands (stays within rate limits)

**Contract calls (per-interaction):**
- `isTokenForSale(tokenId)`, `ownerOf(tokenId)` — on card click / detail navigation

**Filtering (all client-side, instant after initial load):**
- Trait filter sidebar (checkboxes: Background, Tuxedo, Hair, Tie, Weapon)
- Price range filter (min/max input fields)
- Status: For Sale / Not For Sale tabs
- Combined filters: traits + status + price range work together
- Rarity sorting (rarity score calculated client-side from trait frequency)
- Results paginated client-side (20-50 per page)

**UI:**
- Tab: For Sale / Not For Sale
- Grid of NFT cards (image, name, price)
- Client-side pagination controls + asc/desc sort
- Trait filter sidebar
- Price range filter (min/max)

### 3. Token Detail
**Contract calls:**
- `ownerOf(tokenId)`, `tokenURI(tokenId)`, `isTokenForSale(tokenId)`, `getTokenPrice(tokenId)`
- `getCurrentOfferOfAddressForToken(tokenId, connectedWallet)` — detect existing offer
- `getOffersForToken(tokenId, start, count, ascending)`, `getOffersForTokenCount(tokenId)`
- `getTokenSalesHistory(tokenId, start, count, ascending)`, `getTokenSalesHistoryCount(tokenId)`
- `getApproved(tokenId)`
- `buyToken(tokenId, expectedPrice)` — payable
- `listTokenForSale(tokenId, price)`, `removeTokenFromSale(tokenId)`, `updateTokenPrice(tokenId, newPrice)`
- `makeOffer(tokenId)`, `withdrawOffer(tokenId)`, `acceptOffer(tokenId, bidder)`
- `approve(to, tokenId)`, `transferFrom(from, to, tokenId)`, `safeTransferFrom(from, to, tokenId)`

**UI:**
- Large NFT image
- Token name, description, traits (badges)
- Price in XDC + USD equivalent + Buy button (if for sale and not owner)
- Make Offer / Update Offer / Withdraw Offer (if not owner)
- List / Delist / Update Price (if owner)
- Accept Offer dropdown (if owner and offers exist)
- Transfer / Approve modal (if owner)
- Offers table (paginated, sortable asc/desc)
- Sales history table (paginated, sortable asc/desc)

### 4. Profile
**Contract calls:**
- `balanceOf(address)`, `getOwnedTokens(address, start, count, ascending)`, `getOwnedTokensCount(address)`
- `getOffersForBidderAddress(address, start, count, ascending)`, `getOffersForBidderAddressCount(address)`
- `setApprovalForAll(operator, approved)`, `isApprovedForAll(owner, operator)`
- `withdrawOffer(tokenId)` — from my offers list
- `listTokenForSale(tokenId, price)` — from my NFTs

**UI:**
- Tab: My NFTs / My Offers
- My NFTs: grid of owned tokens (paginated, sortable asc/desc), quick actions (list/delist)
- My Offers: table of active offers (paginated, sortable asc/desc), withdraw button
- Operator management: approve/revoke operators

### 5. Activity
**Contract calls:**
- `getGlobalSales(start, count, ascending)`, `getGlobalSalesCount()`
- `getGlobalOffers(start, count, ascending)`, `getGlobalOffersCount()`

**UI:**
- Tab: Sales / Offers
- Sales feed: table with tokenId, seller, buyer, price, timestamp (paginated, sortable asc/desc)
- Offers feed: table with tokenId, bidder, price (paginated, sortable asc/desc)

### 6. Admin
**Contract calls:**
- `owner()`, `isOwner()`
- `setRoyaltyOwner(newRoyaltyOwner)`, `ROYALTY_OWNER`
- `transferOwnership(newOwner)`, `renounceOwnership()`

**UI:**
- Only visible if connected wallet is contract owner
- Set royalty owner address
- Transfer contract ownership
- Renounce ownership (with confirmation)

## Build Order
1. Project scaffolding (Next.js + Tailwind + Wagmi v2 + Viem + RainbowKit + Sonner)
2. Contract ABI extraction + lib/contract.js config
3. Providers setup (WagmiConfig, RainbowKit, QueryClient)
4. Root layout + Navbar (with RainbowKit ConnectButton) + Footer
5. Home page (stats)
6. Browse page (grids + pagination + sorting)
7. Token Detail page (all actions)
8. Profile page (my NFTs + my offers)
9. Activity page (global feeds)
10. Admin page
11. Trait filtering (client-side from metadata)
12. Toast notifications (Sonner for tx status)
13. Responsive design
14. E2E tests with Synpress

## Deploy Script Updates Needed
- Update `deploy/deploy_script.js` to pass correct `tokenURI` for each token
- URI format: metadata URL pointing to each token's JSON

## NFT Assets
- Images: `nfts/officialnfts/Ethereum Killer#0000` through `#9999`
- Metadata: `nfts/master_metadata.json` (4-digit padded keys and names)
- 5 traits: Background (25 values), Tuxedo, Hair, Tie, Weapon
- Trait filtering: client-side, load all metadata once

## Future Enhancements
- **Collection Offer** — bid on any token in the collection without specifying a tokenId. Requires new contract feature (global bid pool where any holder can accept). OpenSea does this off-chain via Seaport protocol.
- **Sweep / Bulk Buy** — buy multiple floor tokens in one click. Requires a separate "sweeper" helper contract that calls `buyToken()` in a loop within a single transaction.
- **Buy Floor Button** — one-click buy the cheapest listed token. Could implement with sequential `buyToken()` calls (multiple wallet confirmations), or combine with sweeper contract for atomic execution.
