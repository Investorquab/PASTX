#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
mod pastx_budget_market {
    use ink::storage::Mapping;

    /// A deliberately compact, testnet-only PASTX market ledger.
    ///
    /// This contract records demo share positions for four synthetic listings.
    /// It does not custody funds, issue transferable stock tokens, or assert
    /// that the reference prices are live/oracle-verified market prices.
    #[ink(storage)]
    pub struct PastxBudgetMarket {
        holdings: Mapping<(AccountId, u8), u32>,
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
                holdings: Mapping::default(),
            }
        }

        /// Returns the demo reference price for stock IDs:
        /// 0 = pAAPL, 1 = pNVDA, 2 = pTSLA, 3 = pMSFT.
        /// Returns zero for an unknown ID.
        #[ink(message)]
        pub fn quote(&self, stock_id: u8) -> u32 {
            Self::price_for(stock_id)
        }

        /// Read a trader's demo share position for one stock ID.
        #[ink(message)]
        pub fn holdings_of(&self, trader: AccountId, stock_id: u8) -> u32 {
            self.holdings.get((trader, stock_id)).unwrap_or(0)
        }

        /// Record a buy (is_buy = true) or sell (is_buy = false).
        ///
        /// This is a paper-share ledger only. No native token is transferred
        /// and no real asset is represented by the listing.
        #[ink(message)]
        pub fn trade(&mut self, stock_id: u8, is_buy: bool, quantity: u32) -> bool {
            if Self::price_for(stock_id) == 0 || quantity == 0 {
                return false;
            }

            let trader = self.env().caller();
            let key = (trader, stock_id);
            let current: u32 = self.holdings.get(key).unwrap_or(0);

            let next = if is_buy {
                match current.checked_add(quantity) {
                    Some(value) => value,
                    None => return false,
                }
            } else {
                match current.checked_sub(quantity) {
                    Some(value) => value,
                    None => return false,
                }
            };

            if next == 0 {
                self.holdings.remove(key);
            } else {
                self.holdings.insert(key, &next);
            }

            true
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

        #[ink::test]
        fn buying_and_selling_updates_only_the_callers_position() {
            let mut market = PastxBudgetMarket::new();
            let accounts = ink::env::test::default_accounts::<ink::env::DefaultEnvironment>();

            ink::env::test::set_caller::<ink::env::DefaultEnvironment>(accounts.alice);
            assert!(market.trade(0, true, 7));
            assert_eq!(market.holdings_of(accounts.alice, 0), 7);
            assert!(market.trade(0, false, 2));
            assert_eq!(market.holdings_of(accounts.alice, 0), 5);
            assert_eq!(market.holdings_of(accounts.bob, 0), 0);
        }

        #[ink::test]
        fn invalid_trades_do_not_change_positions() {
            let mut market = PastxBudgetMarket::new();
            let accounts = ink::env::test::default_accounts::<ink::env::DefaultEnvironment>();

            ink::env::test::set_caller::<ink::env::DefaultEnvironment>(accounts.alice);
            assert!(!market.trade(7, true, 1));
            assert!(!market.trade(0, true, 0));
            assert!(!market.trade(0, false, 1));
            assert_eq!(market.holdings_of(accounts.alice, 0), 0);
        }

        #[ink::test]
        fn all_four_demo_quotes_are_available() {
            let market = PastxBudgetMarket::new();
            assert_eq!(market.quote(0), 200);
            assert_eq!(market.quote(1), 180);
            assert_eq!(market.quote(2), 250);
            assert_eq!(market.quote(3), 400);
            assert_eq!(market.quote(4), 0);
        }
    }
}
