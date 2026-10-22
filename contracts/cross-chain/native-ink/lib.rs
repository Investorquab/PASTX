#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
mod pastx_budget_market {
    use ink::storage::Mapping;

    const CLAIM_AMOUNT: u32 = 1_000;
    const MAX_CLAIMS: u16 = 1_000;
    const CLAIM_COOLDOWN_MS: u64 = 3_600_000;

    /// One-contract, testnet-only PASTX demo with whole-unit pUSD accounting.
    ///
    /// This is an in-app credit ledger, not an ERC-20 token. It has no external
    /// token transfer/allowance interface, no redemption, and no real money.
    /// Stock holdings are synthetic paper positions, not equity or stock tokens.
    /// Prices are fixed: buying converts pUSD into positions; selling converts
    /// those positions back to pUSD at exactly the same price, so trades do not mint.
    #[ink(storage)]
    pub struct PastxBudgetMarket {
        accounts: Mapping<AccountId, (u32, u64)>,
        holdings: Mapping<(AccountId, u8), u32>,
        remaining_claims: u16,
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
                accounts: Mapping::default(),
                holdings: Mapping::default(),
                remaining_claims: MAX_CLAIMS,
            }
        }

        /// Read pUSD balance, synthetic shares, and fixed quote for one listing.
        /// IDs: 0=AAPL, 1=NVDA, 2=TSLA, 3=MSFT.
        #[ink(message)]
        pub fn portfolio_of(&self, trader: AccountId, stock_id: u8) -> (u32, u32, u32) {
            (
                self.accounts.get(trader).unwrap_or((0, 0)).0,
                self.holdings.get((trader, stock_id)).unwrap_or(0),
                Self::price_for(stock_id),
            )
        }

        /// Claim 1,000 whole pUSD. First claim is immediate; the same account
        /// can claim again after one hour. At most 1,000 claims can ever succeed,
        /// so total pUSD issued by the faucet is capped at 1,000,000.
        #[ink(message)]
        pub fn claim(&mut self) -> bool {
            let trader = self.env().caller();
            let now = self.env().block_timestamp();
            let (balance, next_claim_at): (u32, u64) =
                self.accounts.get(trader).unwrap_or((0, 0));
            if next_claim_at != 0 && now < next_claim_at {
                return false;
            }
            if self.remaining_claims == 0 {
                return false;
            }
            let Some(next_claim_count) = self.remaining_claims.checked_sub(1) else {
                return false;
            };
            let Some(next_claim_at) = now.checked_add(CLAIM_COOLDOWN_MS) else {
                return false;
            };
            let Some(next_balance) = balance.checked_add(CLAIM_AMOUNT) else {
                return false;
            };

            self.remaining_claims = next_claim_count;
            self.accounts.insert(trader, &(next_balance, next_claim_at));
            true
        }

        /// Buy (is_buy = true) or sell (is_buy = false) whole synthetic shares.
        /// A buy deducts the fixed pUSD price and adds a position. A sell requires
        /// the position and returns the exact same fixed-price amount. Since each
        /// user can only sell the positions they bought and prices never change,
        /// a sale restores previously committed pUSD; it does not mint new supply.
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
            let (current_balance, next_claim_at): (u32, u64) = self.accounts.get(trader).unwrap_or((0, 0));

            if is_buy {
                let Some(next_holdings) = current_holdings.checked_add(quantity) else {
                    return false;
                };
                if current_balance < cost {
                    return false;
                }
                let Some(next_balance) = current_balance.checked_sub(cost) else {
                    return false;
                };
                self.accounts.insert(trader, &(next_balance, next_claim_at));
                self.holdings.insert(key, &next_holdings);
                true
            } else {
                let Some(next_holdings) = current_holdings.checked_sub(quantity) else {
                    return false;
                };
                let Some(next_balance) = current_balance.checked_add(cost) else {
                    return false;
                };
                self.accounts.insert(trader, &(next_balance, next_claim_at));
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
            assert_eq!(market.portfolio_of(alice, 0).0, CLAIM_AMOUNT);
            assert_eq!(market.remaining_claims, MAX_CLAIMS - 1);
            assert!(!market.claim());

            set_time(10_000 + CLAIM_COOLDOWN_MS - 1);
            assert!(!market.claim());
            set_time(10_000 + CLAIM_COOLDOWN_MS);
            assert!(market.claim());
            assert_eq!(market.portfolio_of(alice, 0).0, 2 * CLAIM_AMOUNT);
            assert_eq!(market.remaining_claims, MAX_CLAIMS - 2);
        }

        #[ink::test]
        fn global_cap_allows_exactly_1000_total_claims() {
            let mut market = PastxBudgetMarket::new();
            let alice = account(0);
            ink::env::test::set_caller::<ink::env::DefaultEnvironment>(alice);

            for claim_index in 0..1_000u64 {
                set_time(claim_index * CLAIM_COOLDOWN_MS);
                assert!(market.claim());
            }
            assert_eq!(market.remaining_claims, 0);
            set_time(1_000 * CLAIM_COOLDOWN_MS);
            assert!(!market.claim());
            ink::env::test::set_caller::<ink::env::DefaultEnvironment>(account(1));
            assert!(!market.claim());
            assert_eq!(market.remaining_claims, 0);
        }

        #[ink::test]
        fn trades_convert_balance_to_shares_and_back_without_extra_minting() {
            let mut market = PastxBudgetMarket::new();
            let alice = account(0);
            ink::env::test::set_caller::<ink::env::DefaultEnvironment>(alice);
            assert!(market.claim());

            assert!(market.trade(0, true, 3));
            assert_eq!(market.portfolio_of(alice, 0).1, 3);
            assert_eq!(market.portfolio_of(alice, 0).0, 400);

            assert!(market.trade(0, false, 2));
            assert_eq!(market.portfolio_of(alice, 0).1, 1);
            assert_eq!(market.portfolio_of(alice, 0).0, 800);
            assert_eq!(market.remaining_claims, MAX_CLAIMS - 1);
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
            assert_eq!(market.portfolio_of(alice, 0).0, CLAIM_AMOUNT);
            assert_eq!(market.portfolio_of(alice, 0).1, 0);
            assert_eq!(market.remaining_claims, MAX_CLAIMS - 1);
        }

        #[ink::test]
        fn portfolio_reports_balance_shares_and_fixed_price() {
            let market = PastxBudgetMarket::new();
            let alice = account(0);
            assert_eq!(market.portfolio_of(alice, 0), (0, 0, 200));
            assert_eq!(market.portfolio_of(alice, 1), (0, 0, 180));
            assert_eq!(market.portfolio_of(alice, 2), (0, 0, 250));
            assert_eq!(market.portfolio_of(alice, 3), (0, 0, 400));
            assert_eq!(market.portfolio_of(alice, 4), (0, 0, 0));
            assert_eq!(market.remaining_claims, MAX_CLAIMS);
        }
    }
}
