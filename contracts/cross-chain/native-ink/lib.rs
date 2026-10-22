#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
mod pastx_budget_market {
    use ink::storage::Mapping;

    const CLAIM_AMOUNT: u32 = 1_000;
    const MAX_CLAIMS: u16 = 1_000;
    const CLAIM_COOLDOWN_MS: u64 = 3_600_000;

    /// Compact one-contract PASTX native demo.
    ///
    /// pUSD is an app-only whole-unit credit ledger, not ERC-20 and not real
    /// money. Listings are synthetic fixed-price paper shares, not equity.
    /// Command modes: 0=read only in a dry-run query, 1=claim, 2=buy, 3=sell.
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

        /// Returns (success, pUSD balance, paper shares for stock_id, quote).
        ///
        /// IDs and fixed quotes: 0=AAPL/200 pUSD, 1=NVDA/180, 2=TSLA/250,
        /// 3=MSFT/400. Unknown IDs return a zero quote.
        ///
        /// Modes:
        /// 0: simulation-only portfolio read. Do not submit as a transaction.
        /// 1: claim 1,000 pUSD, first claim immediately and then once/hour per
        ///    account. Only 1,000 claims can ever succeed globally (1M pUSD).
        /// 2: buy whole shares at fixed price using existing pUSD balance.
        /// 3: sell shares held by the caller at that same fixed price.
        ///
        /// pUSD cannot be externally transferred and has no redemption value.
        /// Buying debits pUSD; selling credits only for shares actually held.
        #[ink(message)]
        pub fn command(
            &mut self,
            action: u8,
            stock_id: u8,
            quantity: u32,
        ) -> (bool, u32, u32, u32) {
            let trader = self.env().caller();
            let price = Self::price_for(stock_id);
            let (balance, next_claim_at): (u32, u64) =
                self.accounts.get(trader).unwrap_or((0, 0));
            let current_shares: u32 = self.holdings.get((trader, stock_id)).unwrap_or(0);

            if action == 0 {
                return (true, balance, current_shares, price);
            }

            if action == 1 {
                let now = self.env().block_timestamp();
                if (next_claim_at != 0 && now < next_claim_at) || self.remaining_claims == 0 {
                    return (false, balance, current_shares, price);
                }
                let (Some(next_balance), Some(next_claim_at), Some(remaining)) = (
                    balance.checked_add(CLAIM_AMOUNT),
                    now.checked_add(CLAIM_COOLDOWN_MS),
                    self.remaining_claims.checked_sub(1),
                ) else {
                    return (false, balance, current_shares, price);
                };
                self.accounts.insert(trader, &(next_balance, next_claim_at));
                self.remaining_claims = remaining;
                return (true, next_balance, current_shares, price);
            }

            if (action != 2 && action != 3) || price == 0 || quantity == 0 {
                return (false, balance, current_shares, price);
            }
            let Some(cost) = price.checked_mul(quantity) else {
                return (false, balance, current_shares, price);
            };

            let (next_shares, next_balance) = if action == 2 {
                (current_shares.checked_add(quantity), balance.checked_sub(cost))
            } else {
                (current_shares.checked_sub(quantity), balance.checked_add(cost))
            };
            let (Some(next_shares), Some(next_balance)) = (next_shares, next_balance) else {
                return (false, balance, current_shares, price);
            };

            self.accounts.insert(trader, &(next_balance, next_claim_at));
            if next_shares == 0 {
                self.holdings.remove((trader, stock_id));
            } else {
                self.holdings.insert((trader, stock_id), &next_shares);
            }
            (true, next_balance, next_shares, price)
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

            assert_eq!(market.command(1, 0, 0), (true, 1_000, 0, 200));
            assert_eq!(market.command(1, 0, 0), (false, 1_000, 0, 200));
            set_time(10_000 + CLAIM_COOLDOWN_MS - 1);
            assert_eq!(market.command(1, 0, 0), (false, 1_000, 0, 200));
            set_time(10_000 + CLAIM_COOLDOWN_MS);
            assert_eq!(market.command(1, 0, 0), (true, 2_000, 0, 200));
            assert_eq!(market.remaining_claims, MAX_CLAIMS - 2);
        }

        #[ink::test]
        fn global_cap_allows_exactly_one_thousand_claims() {
            let mut market = PastxBudgetMarket::new();
            let alice = account(0);
            ink::env::test::set_caller::<ink::env::DefaultEnvironment>(alice);

            for claim_index in 0..1_000u64 {
                set_time(claim_index * CLAIM_COOLDOWN_MS);
                assert!(market.command(1, 0, 0).0);
            }
            assert_eq!(market.remaining_claims, 0);
            set_time(1_000 * CLAIM_COOLDOWN_MS);
            assert!(!market.command(1, 0, 0).0);
            ink::env::test::set_caller::<ink::env::DefaultEnvironment>(account(1));
            assert!(!market.command(1, 0, 0).0);
            assert_eq!(market.remaining_claims, 0);
        }

        #[ink::test]
        fn trades_convert_balance_to_shares_and_back_without_extra_minting() {
            let mut market = PastxBudgetMarket::new();
            let alice = account(0);
            ink::env::test::set_caller::<ink::env::DefaultEnvironment>(alice);
            assert!(market.command(1, 0, 0).0);

            assert_eq!(market.command(2, 0, 3), (true, 400, 3, 200));
            assert_eq!(market.command(3, 0, 2), (true, 800, 1, 200));
            assert_eq!(market.remaining_claims, MAX_CLAIMS - 1);
        }

        #[ink::test]
        fn invalid_trades_do_not_change_balances_or_positions() {
            let mut market = PastxBudgetMarket::new();
            let alice = account(0);
            ink::env::test::set_caller::<ink::env::DefaultEnvironment>(alice);
            assert!(market.command(1, 0, 0).0);
            assert!(!market.command(2, 0, 6).0);
            assert!(!market.command(3, 0, 1).0);
            assert!(!market.command(2, 9, 1).0);
            assert!(!market.command(2, 0, 0).0);
            assert_eq!(market.command(0, 0, 0), (true, CLAIM_AMOUNT, 0, 200));
            assert_eq!(market.remaining_claims, MAX_CLAIMS - 1);
        }

        #[ink::test]
        fn portfolio_mode_is_read_only_and_returns_fixed_quotes() {
            let mut market = PastxBudgetMarket::new();
            let alice = account(0);
            assert_eq!(market.command(0, 0, 0), (true, 0, 0, 200));
            assert_eq!(market.command(0, 1, 0), (true, 0, 0, 180));
            assert_eq!(market.command(0, 2, 0), (true, 0, 0, 250));
            assert_eq!(market.command(0, 3, 0), (true, 0, 0, 400));
            assert_eq!(market.command(0, 9, 0), (true, 0, 0, 0));
            ink::env::test::set_caller::<ink::env::DefaultEnvironment>(alice);
            assert_eq!(market.command(0, 0, 0), (true, 0, 0, 200));
            assert_eq!(market.remaining_claims, MAX_CLAIMS);
        }

        #[ink::test]
        fn unsupported_actions_do_not_change_state() {
            let mut market = PastxBudgetMarket::new();
            assert_eq!(market.command(8, 0, 1), (false, 0, 0, 200));
            assert_eq!(market.remaining_claims, MAX_CLAIMS);
        }
    }
}
