/**
 * @type import('./config').NetworkConfig
 */
module.exports = {
  network: "etherlink-testnet",
  wNativeAddress: "0xB1Ea698633d57705e93b0E40c1077d46CD6A51d8",
  v3: {
    // WXTZ-USDT 500
    wNativeStablePoolAddress: "",
    stableIsToken0: true,
    factoryAddress: "0x481e51E7c1c1E137d80051fFd373cbda71cfd5b7",
    startBlock: 200,
    stableCoins: [
      "0x1A71f491fb0Ef77F13F8f6d2a927dd4C969ECe4f", // eUSD
      "0xD21B917D2f4a4a8E3D12892160BFFd8f4cd72d4F", // USDT
      "0xa7c9092A5D2C3663B7C5F714dbA806d02d62B58a", // USDC
    ],
    whitelistAddresses: [
      "0xB1Ea698633d57705e93b0E40c1077d46CD6A51d8", // WXTZ
      "0x1A71f491fb0Ef77F13F8f6d2a927dd4C969ECe4f", // eUSD
      "0xD21B917D2f4a4a8E3D12892160BFFd8f4cd72d4F", // USDT
      "0xa7c9092A5D2C3663B7C5F714dbA806d02d62B58a", // USDC
      "0x6bDE94725379334b469449f4CF49bCfc85ebFb27", // tzBTC
      "0x8DEF68408Bc96553003094180E5C90d9fe5b88C1", // WETH
      "0xB1Ea698633d57705e93b0E40c1077d46CD6A51d8", // IGN
    ],
    nonfungiblePositionManagerAddress: "0x8682Ce5E26Eb523b3F0E300387008DD8204FfA9C",
    nonfungiblePositionManagerStartBlock: 200,
    minETHLocked: 0,
  },
  masterChefV3: {
    masterChefAddress: "0xa481Be7D0740CA4cC127d3956D75d131d3a48C45",
    startBlock: 200,
  },
};
