#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
mod pastx_budget_market {
    use ink::storage::Mapping;

    const CLAIM_AMOUNT: u32 = 1_000;
    const PUSD_CAP: u32 = 1_000_000;
    const CLAIM_COOLDOWN_MS: u64 = 3_600_000;

    /// One-contract, testnet-only PASTX demo with whole-unit pUSD accounting.
    ///
    /// This is an in-app credit ledger, not an ERC-20 token. It has no external
    /// token transfer/allowance interface, no redemption, and no real money.
    /// Stock holdings are synthetic paper positions, not equity or stock tokens.
    /// Buys move pUSD into the market reserve; sells pay from that reserve.
    #[ink(storage)]
    pub struct PastxBudgetMarket {
        balances: Mapping<AccountId, u32>,
        last_claim_at_plus_one: Mapping<AccountId, u64>,
        holdings: Mapping<(AccountId, u8), u32>,
        total_supply: u32,
        market_reserve: u32,
    }

    impl Default for PastxBudgetMarket {
        fn default() -> Self {
            Self::new()
        }
    }

    impl PastxBudgetMarket {
        #[ink(constructor)]
        pub fn new() -> Self {
            Self {
                balances: Mapping::default(),
                last_claim_at_plus_one: Mapping::default(),
                holdings: Mapping::default(),
                total_supply: 0,
                market_reserve: 0,
            }
        }

        #[ink(message)]
        pub fn balance_of(&self, trader: AccountId) -> u32 {
            self.balances.get(trader).unwrap_or(0)
        }

        /// Claim 1,000 whole pUSD. First claim is immediate; the same account
        /// can claim again after one hour. Total minted balance never exceeds
        /// the fixed 1,000,000 pUSD cap. Returns false without changing state
        /// when the cooldown or cap check fails.
        #[ink(message)]
        pub fn claim(&mut self) -> bool {
            let trader = self.env().caller();
            let now = self.env().block_timestamp();
            let marker: u64 = self.last_claim_at_plus_one.get(trader).unwrap_or(0);

            if marker != 0 {
                let Some(last_claim) = marker.checked_sub(1) else {
                    return false;
                };
                let Some(elapsed) = now.checked_sub(last_claim) else {
                    return false;
                };
                if elapsed < CLAIM_COOLDOWN_MS {
                    return false;
                }
            }

            let Some(next_supply) = self.total_supply.checked_add(CLAIM_AMOUNT) else {
                return false;
            };
            if next_supply > PUSD_CAP {
                return false;
            }
            let Some(next_marker) = now.checked_add(1) else {
                return false;
            };
            let balance: u32 = self.balances.get(trader).unwrap_or(0);
            let Some(next_balance) = balance.checked_add(CLAIM_AMOUNT) else {
                return false;
            };

            self.total_supply = next_supply;
            self.balances.insert(trader, &next_balance);
            self.last_claim_at_plus_one.insert(trader, &next_marker);
            true
        }

        /// Fixed reference price per share in whole pUSD:
        /// 0 = pAAPL (200), 1 = pNVDA (180), 2 = pTSLA (250), 3 = pMSFT (400).
        /// These are demo prices, not live/oracle prices.
        #[ink(message)]
        pub fn quote(&self, stock_id: u8) -> u32 {
            Self::price_for(stock_id)
        }

        #[ink(message)]
        pub fn holdings_of(&self, trader: AccountId, stock_id: u8) -> u32 {
            self.holdings.get((trader, stock_id)).unwrap_or(0)
        }

        /// Buy (is_buy = true) or sell (is_buy = false) whole synthetic shares.
        /// Buys require enough pUSD and add it to the market reserve. Sells
        /// require enough shares and reserve pUSD. Trading never mints pUSD.
        #[ink(message)]
        pub fn trade(&mut self, stock_id: u8, is_buy: bool, quantity: u32) -> bool {
            let price = Self::price_for(stock_id);
            if price == 0 || quantity == 0 {
                return false;
            }

            let Some(cost) = price.checked_mul(quantity) else {
                return false;
            };
            let trader = self.env().caller();
            let key = (trader, stock_id);
            let current_holdings: u32 = self.holdings.get(key).unwrap_or(0);
            let current_balance: u32 = self.balances.get(trader).unwrap_or(0);

            if is_buy {
                let Some(next_holdings) = current_holdings.checked_add(quantity) else {
                    return false;
                };
                if current_balance < cost {
                    return false;
                }
                let Some(next_reserve) = self.market_reserve.checked_add(cost) else {
                    return false;
                };
                let Some(next_balance) = current_balance.checked_sub(cost) else {
                    return false;
                };
                self.market_reserve = next_reserve;
                self.balances.insert(trader, &next_balance);
                self.holdings.insert(key, &next_holdings);
                true
            } else {
                let Some(next_holdings) = current_holdings.checked_sub(quantity) else {
                    return false;
                };
                if self.market_reserve < cost {
                    return false;
                }
                let Some(next_balance) = current_balance.checked_add(cost) else {
                    return false;
                };
                let Some(next_reserve) = self.market_reserve.checked_sub(cost) else {
                    return false;
                };
                self.market_reserve = next_reserve;
                self.balances.insert(trader, &next_balance);
                if next_holdings == 0 {
                    self.holdings.remove(key);
                } else {
                    self.holdings.insert(key, &next_holdings);
                }
                true
            }
        }
    }

    impl PastxBudgetMarket {
        fn price_for(stock_id: u8) -> u32 {
            match stock_id {
                0 => 200,
                1 => 180,
                2 => 250,
                3 => 400,
                _ => 0,
            }
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        fn account(index: u32) -> ink::primitives::AccountId {
            let accounts = ink::env::test::default_accounts::<ink::env::DefaultEnvironment>();
            match index {
                0 => accounts.alice,
                1 => accounts.bob,
                _ => accounts.charlie,
            }
        }

        fn set_time(timestamp: u64) {
            ink::env::test::set_block_timestamp::<ink::env::DefaultEnvironment>(timestamp);
        }

        #[ink::test]
        fn claim_mints_1000_and_enforces_one_hour_cooldown() {
            let mut market = PastxBudgetMarket::new();
            let alice = account(0);
            ink::env::test::set_caller::<ink::env::DefaultEnvironment>(alice);
            set_time(10_000);

            assert!(market.claim());
            assert_eq!(market.balance_of(alice), CLAIM_AMOUNT);
            assert_eq!(market.total_supply, CLAIM_AMOUNT);
            assert!(!market.claim());

            set_time(10_000 + CLAIM_COOLDOWN_MS - 1);
            assert!(!market.claim());
            set_time(10_000 + CLAIM_COOLDOWN_MS);
            assert!(market.claim());
            assert_eq!(market.balance_of(alice), 2 * CLAIM_AMOUNT);
            assert_eq!(market.total_supply, 2 * CLAIM_AMOUNT);
        }

        #[ink::test]
        fn global_cap_stops_claims_at_one_million() {
            let mut market = PastxBudgetMarket::new();
            let alice = account(0);
            ink::env::test::set_caller::<ink::env::DefaultEnvironment>(alice);

            for claim_index in 0..1_000u64 {
                set_time(claim_index * CLAIM_COOLDOWN_MS);
                assert!(market.claim());
            }
            assert_eq!(market.total_supply, PUSD_CAP);
            set_time(1_000 * CLAIM_COOLDOWN_MS);
            assert!(!market.claim());
            ink::env::test::set_caller::<ink::env::DefaultEnvironment>(account(1));
            assert!(!market.claim());
            assert_eq!(market.total_supply, PUSD_CAP);
        }

        #[ink::test]
        fn trades_use_market_reserve_and_never_mint_pusd() {
            let mut market = PastxBudgetMarket::new();
            let alice = account(0);
            ink::env::test::set_caller::<ink::env::DefaultEnvironment>(alice);
            assert!(market.claim());
            set_time(CLAIM_COOLDOWN_MS);
            assert!(market.claim());

            assert!(market.trade(0, true, 7));
            assert_eq!(market.holdings_of(alice, 0), 7);
            assert_eq!(market.balance_of(alice), 600);
            assert_eq!(market.market_reserve, 1_400);

            assert!(market.trade(0, false, 2));
            assert_eq!(market.holdings_of(alice, 0), 5);
            assert_eq!(market.balance_of(alice), 1_000);
            assert_eq!(market.market_reserve, 1_000);
            assert_eq!(market.total_supply, 2 * CLAIM_AMOUNT);
        }

        #[ink::test]
        fn invalid_trades_do_not_change_balances_or_positions() {
            let mut market = PastxBudgetMarket::new();
            let alice = account(0);
            ink::env::test::set_caller::<ink::env::DefaultEnvironment>(alice);
            assert!(market.claim());
            assert!(!market.trade(0, true, 6));
            assert!(!market.trade(0, false, 1));
            assert!(!market.trade(9, true, 1));
            assert!(!market.trade(0, true, 0));
            assert_eq!(market.balance_of(alice), CLAIM_AMOUNT);
            assert_eq!(market.holdings_of(alice, 0), 0);
            assert_eq!(market.total_supply, CLAIM_AMOUNT);
        }

        #[ink::test]
        fn fixed_quotes_match_market_demo() {
            let market = PastxBudgetMarket::new();
            assert_eq!(market.quote(0), 200);
            assert_eq!(market.quote(1), 180);
            assert_eq!(market.quote(2), 250);
            assert_eq!(market.quote(3), 400);
            assert_eq!(market.quote(4), 0);
            assert_eq!(market.total_supply, 0);
        }
    }
}
