/* eslint-disable prefer-const */
import { Address, BigDecimal } from "@graphprotocol/graph-ts/index";
import { Bundle, Pair, Token } from "../generated/schema";
import { ADDRESS_ZERO, factoryContract, ONE_BD, ZERO_BD } from "./utils";

// prettier-ignore
let WETH_ADDRESS = "0xB1Ea698633d57705e93b0E40c1077d46CD6A51d8";
// prettier-ignore
let WETH_EUSD_PAIR = "0x9ab92635d4d949069023e7c541e5a272a0f07da1";
// prettier-ignore
let WETH_USDT_PAIR = "0x0000000000000000000000000000000000000000";
// prettier-ignore
let WETH_USDC_PAIR = "0x0000000000000000000000000000000000000000";

export function getETHPriceInUSD(): BigDecimal {
  // fetch eth prices for each stablecoin
  let eusdPair = Pair.load(WETH_EUSD_PAIR); // eusd is token0
  let usdcPair = Pair.load(WETH_USDC_PAIR); // usdc is token0
  let usdtPair = Pair.load(WETH_USDT_PAIR); // usdt is token1

  // all 3 pairs have been created
  if (eusdPair !== null && usdcPair !== null && usdtPair !== null) {
    let totalLiquidityBNB = eusdPair.reserve1.plus(usdcPair.reserve1).plus(usdtPair.reserve0);
    if (totalLiquidityBNB.notEqual(ZERO_BD)) {
      let eusdWeight = eusdPair.reserve1.div(totalLiquidityBNB);
      let usdtWeight = usdtPair.reserve0.div(totalLiquidityBNB);
      let usdcWeight = usdcPair.reserve1.div(totalLiquidityBNB);
      return eusdPair.token0Price
        .times(eusdWeight)
        .plus(usdcPair.token0Price.times(usdcWeight))
        .plus(usdtPair.token1Price.times(usdtWeight));
      // eUSD and USDC have been created
    } else {
      return ZERO_BD;
    }
  } else if (eusdPair !== null && usdcPair !== null) {
    let totalLiquidityETH = eusdPair.reserve1.plus(usdcPair.reserve1);
    let eusdWeight = eusdPair.reserve1.div(totalLiquidityETH);
    let usdcWeight = usdcPair.reserve1.div(totalLiquidityETH);
    return eusdPair.token0Price.times(eusdWeight).plus(usdcPair.token0Price.times(usdcWeight));
    // eUSD is the only pair created so far
  } else if (eusdPair !== null) {
    return eusdPair.token0Price;
  } else {
    return ZERO_BD;
  }
}

// Tokens whose amounts should contribute to tracked volume and liquidity
// prettier-ignore
let WHITELIST: string[] = [
  "0xB1Ea698633d57705e93b0E40c1077d46CD6A51d8", // WXTZ
  "0x1A71f491fb0Ef77F13F8f6d2a927dd4C969ECe4f", // eUSD
  "0xD21B917D2f4a4a8E3D12892160BFFd8f4cd72d4F", // USDT
  "0xa7c9092A5D2C3663B7C5F714dbA806d02d62B58a", // USDC
  "0x8DEF68408Bc96553003094180E5C90d9fe5b88C1", // WETH
  "0x6bDE94725379334b469449f4CF49bCfc85ebFb27", // tzBTC
  "0xBeEfb119631691a1e0D9378fA7864fC6E67A72Ad", // IGN
];

// minimum liquidity for price to get tracked
let MINIMUM_LIQUIDITY_THRESHOLD_ETH = BigDecimal.fromString("0");

/**
 * Search through graph to find derived BNB per token.
 * @todo update to be derived BNB (add stablecoin estimates)
 **/
export function findEthPerToken(token: Token): BigDecimal {
  if (token.id == WETH_ADDRESS) {
    return ONE_BD;
  }
  // loop through whitelist and check if paired with any
  for (let i = 0; i < WHITELIST.length; ++i) {
    let pairAddress = factoryContract.getPair(Address.fromString(token.id), Address.fromString(WHITELIST[i]));
    if (pairAddress.toHex() != ADDRESS_ZERO) {
      let pair = Pair.load(pairAddress.toHex());
      if (pair.token0 == token.id && pair.reserveETH.gt(MINIMUM_LIQUIDITY_THRESHOLD_ETH)) {
        let token1 = Token.load(pair.token1);
        return pair.token1Price.times(token1.derivedETH as BigDecimal); // return token1 per our token * BNB per token 1
      }
      if (pair.token1 == token.id && pair.reserveETH.gt(MINIMUM_LIQUIDITY_THRESHOLD_ETH)) {
        let token0 = Token.load(pair.token0);
        return pair.token0Price.times(token0.derivedETH as BigDecimal); // return token0 per our token * BNB per token 0
      }
    }
  }
  return ZERO_BD; // nothing was found return 0
}

/**
 * Accepts tokens and amounts, return tracked fee amount based on token whitelist
 * If both are, return the difference between the token amounts
 * If not, return 0
 */
export function getTrackedFeeVolumeUSD(
  bundle: Bundle,
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token
): BigDecimal {
  let price0 = token0.derivedETH.times(bundle.ethPrice);
  let price1 = token1.derivedETH.times(bundle.ethPrice);

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    let tokenAmount0USD = tokenAmount0.times(price0);
    let tokenAmount1USD = tokenAmount1.times(price1);
    if (tokenAmount0USD.ge(tokenAmount1USD)) {
      return tokenAmount0USD.minus(tokenAmount1USD);
    } else {
      return tokenAmount1USD.minus(tokenAmount0USD);
    }
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD;
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD.
 * If both are, return average of two amounts
 * If neither is, return 0
 */
export function getTrackedVolumeUSD(
  bundle: Bundle,
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token
): BigDecimal {
  let price0 = token0.derivedETH.times(bundle.ethPrice);
  let price1 = token1.derivedETH.times(bundle.ethPrice);

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).plus(tokenAmount1.times(price1)).div(BigDecimal.fromString("2"));
  }

  // take full value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0);
  }

  // take full value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1);
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD;
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD * 2.
 * If both are, return sum of two amounts
 * If neither is, return 0
 */
export function getTrackedLiquidityUSD(
  bundle: Bundle,
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token
): BigDecimal {
  let price0 = token0.derivedETH.times(bundle.ethPrice);
  let price1 = token1.derivedETH.times(bundle.ethPrice);

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).plus(tokenAmount1.times(price1));
  }

  // take double value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).times(BigDecimal.fromString("2"));
  }

  // take double value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1).times(BigDecimal.fromString("2"));
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD;
}
