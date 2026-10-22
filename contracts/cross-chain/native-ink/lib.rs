#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
mod pastx_budget_market {
    use ink::storage::Mapping;

    // pUSD uses standard 18-decimal fixed-point units, as the EVM demo token does.
    const PUSD_UNIT: u128 = 1_000_000_000_000_000_000;
    const CLAIM_AMOUNT: u128 = 1_000 * PUSD_UNIT;
    const PUSD_CAP: u128 = 1_000_000 * PUSD_UNIT;
    const CLAIM_COOLDOWN_MS: u64 = 3_600_000;

    /// One-contract, testnet-only PASTX demo.
    ///
    /// pUSD is a capped, non-redeemable demo ledger token. It is not USDC,
    /// does not represent real money, and does not custody native tPOT.
    /// Stock positions are synthetic paper holdings, not equity or transferable
    /// stock tokens. A buy moves pUSD into the internal market reserve; a sell
    /// pays pUSD from that reserve, so trading does not inflate pUSD supply.
    #[ink(storage)]
    pub struct PastxBudgetMarket {
        balances: Mapping<AccountId, u128>,
        last_claim_at_plus_one: Mapping<AccountId, u64>,
        holdings: Mapping<(AccountId, u8), u32>,
        total_supply: u128,
        market_reserve: u128,
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

        /// pUSD decimal places. Balances/supply/claim amount use 18-decimal raw units.
        #[ink(message)]
        pub fn decimals(&self) -> u8 {
            18
        }

        /// Amount minted by each successful faucet claim, in 18-decimal raw units.
        #[ink(message)]
        pub fn claim_amount(&self) -> u128 {
            CLAIM_AMOUNT
        }

        /// Hard cap of all pUSD, including balances and the market reserve.
        #[ink(message)]
        pub fn total_cap(&self) -> u128 {
            PUSD_CAP
        }

        /// Faucet cooldown in milliseconds.
        #[ink(message)]
        pub fn claim_cooldown_ms(&self) -> u64 {
            CLAIM_COOLDOWN_MS
        }

        #[ink(message)]
        pub fn total_supply(&self) -> u128 {
            self.total_supply
        }

        #[ink(message)]
        pub fn balance_of(&self, trader: AccountId) -> u128 {
            self.balances.get(trader).unwrap_or(0)
        }

        /// Claim 1,000 pUSD. First claim is immediate; subsequent claims from
        /// the same account require one hour. Supply never exceeds 1,000,000 pUSD.
        /// Returns false instead of changing state if cooldown/cap checks fail.
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
            let balance: u128 = self.balances.get(trader).unwrap_or(0);
            let Some(next_balance) = balance.checked_add(CLAIM_AMOUNT) else {
                return false;
            };

            self.total_supply = next_supply;
            self.balances.insert(trader, &next_balance);
            self.last_claim_at_plus_one.insert(trader, &next_marker);
            true
        }

        /// Transfer pUSD between demo accounts. Amount is in 18-decimal raw units.
        #[ink(message)]
        pub fn transfer(&mut self, to: AccountId, amount: u128) -> bool {
            if amount == 0 {
                return false;
            }
            let from = self.env().caller();
            let from_balance: u128 = self.balances.get(from).unwrap_or(0);
            if from_balance < amount {
                return false;
            }
            if from == to {
                return true;
            }
            let to_balance: u128 = self.balances.get(to).unwrap_or(0);
            let Some(next_to_balance) = to_balance.checked_add(amount) else {
                return false;
            };
            let Some(next_from_balance) = from_balance.checked_sub(amount) else {
                return false;
            };
            self.balances.insert(from, &next_from_balance);
            self.balances.insert(to, &next_to_balance);
            true
        }

        /// Returns the fixed demo quote in whole pUSD:
        /// 0 = pAAPL (200), 1 = pNVDA (180), 2 = pTSLA (250), 3 = pMSFT (400).
        /// Returns zero for unknown IDs. Quotes are not live-market data.
        #[ink(message)]
        pub fn quote(&self, stock_id: u8) -> u32 {
            Self::price_for(stock_id)
        }

        /// Returns the same quote as an 18-decimal pUSD amount.
        #[ink(message)]
        pub fn quote_pusd_raw(&self, stock_id: u8) -> u128 {
            (Self::price_for(stock_id) as u128).checked_mul(PUSD_UNIT).unwrap_or(0)
        }

        /// Read a trader's paper-share position for one stock ID.
        #[ink(message)]
        pub fn holdings_of(&self, trader: AccountId, stock_id: u8) -> u32 {
            self.holdings.get((trader, stock_id)).unwrap_or(0)
        }

        /// Buy (is_buy = true) or sell (is_buy = false) whole synthetic shares.
        ///
        /// Buys deduct pUSD from the caller and add it to the market reserve.
        /// Sells require enough shares and sufficient pUSD in that reserve.
        /// A successful trade never mints/burns pUSD or changes total supply.
        #[ink(message)]
        pub fn trade(&mut self, stock_id: u8, is_buy: bool, quantity: u32) -> bool {
            let price = Self::price_for(stock_id);
            if price == 0 || quantity == 0 {
                return false;
            }

            let Some(cost) = (price as u128)
                .checked_mul(quantity as u128)
                .and_then(|whole| whole.checked_mul(PUSD_UNIT))
            else {
                return false;
            };

            let trader = self.env().caller();
            let holdings_key = (trader, stock_id);
            let current_holdings: u32 = self.holdings.get(holdings_key).unwrap_or(0);
            let current_balance: u128 = self.balances.get(trader).unwrap_or(0);

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
                self.holdings.insert(holdings_key, &next_holdings);
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
                    self.holdings.remove(holdings_key);
                } else {
                    self.holdings.insert(holdings_key, &next_holdings);
                }
                true
            }
        }

        /// pUSD held by the synthetic market to settle sells.
        #[ink(message)]
        pub fn market_reserve(&self) -> u128 {
            self.market_reserve
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

        fn account(
            index: u32,
        ) -> ink::primitives::AccountId {
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
        fn claim_mints_1000_pusd_first_time_and_enforces_one_hour_cooldown() {
            let mut market = PastxBudgetMarket::new();
            let alice = account(0);
            ink::env::test::set_caller::<ink::env::DefaultEnvironment>(alice);
            set_time(10_000);

            assert!(market.claim());
            assert_eq!(market.balance_of(alice), CLAIM_AMOUNT);
            assert_eq!(market.total_supply(), CLAIM_AMOUNT);
            assert!(!market.claim());

            set_time(10_000 + CLAIM_COOLDOWN_MS - 1);
            assert!(!market.claim());
            set_time(10_000 + CLAIM_COOLDOWN_MS);
            assert!(market.claim());
            assert_eq!(market.balance_of(alice), 2 * CLAIM_AMOUNT);
            assert_eq!(market.total_supply(), 2 * CLAIM_AMOUNT);
        }

        #[ink::test]
        fn global_supply_cap_stops_claims_at_exactly_one_million_pusd() {
            let mut market = PastxBudgetMarket::new();
            let alice = account(0);
            ink::env::test::set_caller::<ink::env::DefaultEnvironment>(alice);

            for claim_index in 0..1_000u64 {
                set_time(claim_index * CLAIM_COOLDOWN_MS);
                assert!(market.claim());
            }
            assert_eq!(market.total_supply(), PUSD_CAP);
            set_time(1_000 * CLAIM_COOLDOWN_MS);
            assert!(!market.claim());
            ink::env::test::set_caller::<ink::env::DefaultEnvironment>(account(1));
            assert!(!market.claim());
            assert_eq!(market.total_supply(), PUSD_CAP);
        }

        #[ink::test]
        fn transfers_preserve_supply_and_reject_overspending() {
            let mut market = PastxBudgetMarket::new();
            let alice = account(0);
            let bob = account(1);
            ink::env::test::set_caller::<ink::env::DefaultEnvironment>(alice);
            assert!(market.claim());
            assert!(!market.transfer(bob, CLAIM_AMOUNT + 1));
            assert!(market.transfer(bob, 125 * PUSD_UNIT));
            assert_eq!(market.balance_of(alice), 875 * PUSD_UNIT);
            assert_eq!(market.balance_of(bob), 125 * PUSD_UNIT);
            assert_eq!(market.total_supply(), CLAIM_AMOUNT);
        }

        #[ink::test]
        fn trades_use_pusd_reserves_and_do_not_mint_tokens() {
            let mut market = PastxBudgetMarket::new();
            let alice = account(0);
            ink::env::test::set_caller::<ink::env::DefaultEnvironment>(alice);
            assert!(market.claim());
            set_time(CLAIM_COOLDOWN_MS);
            assert!(market.claim());

            assert!(market.trade(0, true, 7));
            assert_eq!(market.holdings_of(alice, 0), 7);
            assert_eq!(market.balance_of(alice), 600 * PUSD_UNIT);
            assert_eq!(market.market_reserve(), 1_400 * PUSD_UNIT);

            assert!(market.trade(0, false, 2));
            assert_eq!(market.holdings_of(alice, 0), 5);
            assert_eq!(market.balance_of(alice), 1_000 * PUSD_UNIT);
            assert_eq!(market.market_reserve(), 1_000 * PUSD_UNIT);
            assert_eq!(market.total_supply(), 2 * CLAIM_AMOUNT);
        }

        #[ink::test]
        fn users_cannot_sell_more_than_they_hold_or_withdraw_an_empty_reserve() {
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
            assert_eq!(market.total_supply(), CLAIM_AMOUNT);
        }

        #[ink::test]
        fn fixed_quotes_match_the_existing_market_demo() {
            let market = PastxBudgetMarket::new();
            assert_eq!(market.decimals(), 18);
            assert_eq!(market.quote(0), 200);
            assert_eq!(market.quote(1), 180);
            assert_eq!(market.quote(2), 250);
            assert_eq!(market.quote(3), 400);
            assert_eq!(market.quote(4), 0);
            assert_eq!(market.quote_pusd_raw(0), 200 * PUSD_UNIT);
            assert_eq!(market.claim_amount(), 1_000 * PUSD_UNIT);
            assert_eq!(market.total_cap(), 1_000_000 * PUSD_UNIT);
            assert_eq!(market.claim_cooldown_ms(), 3_600_000);
        }
    }
}
