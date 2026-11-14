// Every word of the token disclosure, in one place, so it's reviewed (and
// corrected) as one thing. Lowercase and plain like the rest of the site.
//
// TODO(token): fill in every TODO below from the launch's actual onchain
// parameters before setting NEXT_PUBLIC_TOKEN_ADDRESS. The page renders these
// values as written, so a placeholder left here would be published.

export const TOKEN_NAME = "TODO: token name";
export const TOKEN_SYMBOL = "TODO: symbol";

/** The fee recipients set at launch and each one's share of trading fees. */
export const FEE_RECIPIENTS = [
  {
    label: "development of outship",
    share: "TODO: %",
    address: "TODO: 0x… recipient address",
  },
  {
    label: "shipper rewards wallet",
    share: "TODO: %",
    address: "TODO: 0x… recipient address",
  },
] as const;

export const TEAM_ALLOCATION = "TODO: % of supply";
export const TEAM_VESTING = "TODO: vesting schedule, e.g. a cliff then linear unlock, and the vault address";

export const DISCLOSURE = {
  what: `${TOKEN_NAME} (${TOKEN_SYMBOL}) is a token on base, launched through clanker. it's a separate thing from outship's scores, ranks and attestations.`,
  fees: "trading fees from the token's liquidity pool go to the recipients set at launch: development of outship, and a wallet for rewarding shippers.",
  fixed: "the fee split is fixed onchain by the launch contract. outship can't change it, and anyone can check it on basescan.",
  team: `the team holds ${TEAM_ALLOCATION}, vesting as follows: ${TEAM_VESTING}.`,
  notInvestment:
    "this isn't an investment product. there's no promise of returns, no promise of value, and no promise outship will buy, support or list it anywhere. tokens can lose all their value. don't buy what you can't afford to lose.",
  noScore:
    "the token never affects score or rank. holding it, buying it or paying with it changes nothing about anyone's score, rank, streak or visibility on outship. only ships github verifies do.",
} as const;
