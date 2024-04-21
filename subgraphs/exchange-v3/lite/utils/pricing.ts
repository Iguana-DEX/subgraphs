/* eslint-disable prefer-const */
import { ONE_BD, ZERO_BD, ZERO_BI } from "./constants";
import { Bundle, Pool, Token } from "../generated/schema";
import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { exponentToBigDecimal, safeDiv } from "./index";

// prettier-ignore
const WETH_ADDRESS = "0x8DEF68408Bc96553003094180E5C90d9fe5b88C1";
// prettier-ignore
const USDC_WETH_03_POOL = "0x9644e26ef0ec0659e453dd8035d6b2a169eb65aa"; // WXTZ_eUSD pool

const STABLE_IS_TOKEN0 = "true" as string;

// token where amounts should contribute to tracked volume and liquidity
// usually tokens that many tokens are paired with s

export const WHITELIST_TOKENS: string[] = [
  "0xB1Ea698633d57705e93b0E40c1077d46CD6A51d8", // WXTZ
  "0x1A71f491fb0Ef77F13F8f6d2a927dd4C969ECe4f", // eUSD
  "0xD21B917D2f4a4a8E3D12892160BFFd8f4cd72d4F", // USDT
  "0xa7c9092A5D2C3663B7C5F714dbA806d02d62B58a", // USDC
  "0x6bDE94725379334b469449f4CF49bCfc85ebFb27", // tzBTC
  "0x8DEF68408Bc96553003094180E5C90d9fe5b88C1", // WETH
  "0xB1Ea698633d57705e93b0E40c1077d46CD6A51d8", // IGN
];

const STABLE_COINS: string[] = [
  "0x1A71f491fb0Ef77F13F8f6d2a927dd4C969ECe4f", // eUSD
  "0xD21B917D2f4a4a8E3D12892160BFFd8f4cd72d4F", // USDT
  "0xa7c9092A5D2C3663B7C5F714dbA806d02d62B58a", // USDC
];

const MINIMUM_ETH_LOCKED = BigDecimal.fromString("60");

let Q192 = 2 ** 192;
export function sqrtPriceX96ToTokenPrices(sqrtPriceX96: BigInt, token0: Token, token1: Token): BigDecimal[] {
  let num = sqrtPriceX96.times(sqrtPriceX96).toBigDecimal();
  let denom = BigDecimal.fromString(Q192.toString());
  let price1 = num.div(denom).times(exponentToBigDecimal(token0.decimals)).div(exponentToBigDecimal(token1.decimals));

  let price0 = safeDiv(BigDecimal.fromString("1"), price1);
  return [price0, price1];
}

export function getEthPriceInUSD(): BigDecimal {
  // fetch eth prices for each stablecoin
  let usdcPool = Pool.load(USDC_WETH_03_POOL); // dai is token0
  if (usdcPool !== null) {
    if (STABLE_IS_TOKEN0 === "true") {
      return usdcPool.token0Price;
    }
    return usdcPool.token1Price;
  } else {
    return ZERO_BD;
  }
}

/**
 * Search through graph to find derived Eth per token.
 * @todo update to be derived ETH (add stablecoin estimates)
 **/
export function findEthPerToken(token: Token): BigDecimal {
  if (token.id == WETH_ADDRESS) {
    return ONE_BD;
  }
  let whiteList = token.whitelistPools;
  // for now just take USD from pool with greatest TVL
  // need to update this to actually detect best rate based on liquidity distribution
  let largestLiquidityETH = ZERO_BD;
  let priceSoFar = ZERO_BD;
  let bundle = Bundle.load("1");

  // hardcoded fix for incorrect rates
  // if whitelist includes token - get the safe price
  if (STABLE_COINS.includes(token.id)) {
    priceSoFar = safeDiv(ONE_BD, bundle.ethPriceUSD);
  } else {
    for (let i = 0; i < whiteList.length; ++i) {
      let poolAddress = whiteList[i];
      let pool = Pool.load(poolAddress);

      if (pool.liquidity.gt(ZERO_BI)) {
        if (pool.token0 == token.id) {
          // whitelist token is token1
          let token1 = Token.load(pool.token1);
          // get the derived ETH in pool
          let ethLocked = pool.totalValueLockedToken1.times(token1.derivedETH);
          if (ethLocked.gt(largestLiquidityETH) && ethLocked.gt(MINIMUM_ETH_LOCKED)) {
            largestLiquidityETH = ethLocked;
            // token1 per our token * Eth per token1
            priceSoFar = pool.token1Price.times(token1.derivedETH as BigDecimal);
          }
        }
        if (pool.token1 == token.id) {
          let token0 = Token.load(pool.token0);
          // get the derived ETH in pool
          let ethLocked = pool.totalValueLockedToken0.times(token0.derivedETH);
          if (ethLocked.gt(largestLiquidityETH) && ethLocked.gt(MINIMUM_ETH_LOCKED)) {
            largestLiquidityETH = ethLocked;
            // token0 per our token * ETH per token0
            priceSoFar = pool.token0Price.times(token0.derivedETH as BigDecimal);
          }
        }
      }
    }
  }
  return priceSoFar; // nothing was found return 0
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD * 2.
 * If both are, return sum of two amounts
 * If neither is, return 0
 */
export function getTrackedAmountUSD(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token
): BigDecimal {
  let bundle = Bundle.load("1");
  let price0USD = token0.derivedETH.times(bundle.ethPriceUSD);
  let price1USD = token1.derivedETH.times(bundle.ethPriceUSD);

  // both are whitelist tokens, return sum of both amounts
  if (WHITELIST_TOKENS.includes(token0.id) && WHITELIST_TOKENS.includes(token1.id)) {
    return tokenAmount0.times(price0USD).plus(tokenAmount1.times(price1USD));
  }

  // take double value of the whitelisted token amount
  if (WHITELIST_TOKENS.includes(token0.id) && !WHITELIST_TOKENS.includes(token1.id)) {
    return tokenAmount0.times(price0USD).times(BigDecimal.fromString("2"));
  }

  // take double value of the whitelisted token amount
  if (!WHITELIST_TOKENS.includes(token0.id) && WHITELIST_TOKENS.includes(token1.id)) {
    return tokenAmount1.times(price1USD).times(BigDecimal.fromString("2"));
  }

  // neither token is on white list, tracked amount is 0
  return ZERO_BD;
}
