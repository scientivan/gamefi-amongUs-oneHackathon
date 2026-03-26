#[test_only]
module among_nads::game_tests {

    use among_nads::game::{
        Self,
        AdminCap,
        HousePool,
        Game,
        //ONE,
    };
    use sui::test_scenario as ts;
    use sui::test_scenario::Scenario;
    use sui::coin;
    use sui::clock::{Self, Clock};
    use sui::test_utils::assert_eq;

    // ═══════════════════════════════════════════════════════════
    // TEST ADDRESSES
    // Pengganti: address public alice, bob, carol, eve di Solidity
    // ═══════════════════════════════════════════════════════════
    const OWNER: address = @0xABCD;
    const ALICE: address = @0x1111;
    const BOB: address   = @0x2222;
    const CAROL: address = @0x3333;
    const EVE: address   = @0x4444;

    // ═══════════════════════════════════════════════════════════
    // HELPER FUNCTIONS
    // ═══════════════════════════════════════════════════════════

    fun setup_game(scenario: &mut Scenario) {
        // Init contract sebagai OWNER
        ts::next_tx(scenario, OWNER);
        {
            game::init_for_testing(ts::ctx(scenario));
        };

        // Owner deposit 10 ONE ke house pool
        ts::next_tx(scenario, OWNER);
        {
            let mut house = ts::take_shared<HousePool>(scenario);
            let cap = ts::take_from_sender<AdminCap>(scenario);
            let clock = clock::create_for_testing(ts::ctx(scenario));

            let payment = sui::coin::mint_for_testing<sui::sui::SUI>(
                10_000_000_000, // 10 ONE
                ts::ctx(scenario)
            );
            game::deposit(&cap, &mut house, payment);

            clock::destroy_for_testing(clock);
            ts::return_shared(house);
            ts::return_to_sender(scenario, cap);
        };
    }

    // ═══════════════════════════════════════════════════════════
    // TEST 1: Deploy dan Deposit
    // ═══════════════════════════════════════════════════════════
    #[test]
    fun test_deposit_happy() {
        let mut scenario = ts::begin(OWNER);
        setup_game(&mut scenario);

        ts::next_tx(&mut scenario, OWNER);
        {
            let house = ts::take_shared<HousePool>(&scenario);
            // Verifikasi house balance = 10 ONE
            assert_eq(game::get_house_balance(&house), 10_000_000_000);
            ts::return_shared(house);
        };

        ts::end(scenario);
    }

    // ═══════════════════════════════════════════════════════════
    // TEST 2: Seed Pool — buat game baru
    // ═══════════════════════════════════════════════════════════
    #[test]
    fun test_seed_pool_creates_game() {
        let mut scenario = ts::begin(OWNER);
        setup_game(&mut scenario);

        ts::next_tx(&mut scenario, OWNER);
        {
            let mut house = ts::take_shared<HousePool>(&scenario);
            let cap = ts::take_from_sender<AdminCap>(&scenario);
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clock, 0);

            // Seed: 1 ONE per tim
            game::seed_pool(
                &cap,
                &mut house,
                1_000_000_000, // 1 ONE crew seed
                1_000_000_000, // 1 ONE imp seed
                &clock,
                ts::ctx(&mut scenario),
            );

            // House balance berkurang 2 ONE
            assert_eq(game::get_house_balance(&house), 8_000_000_000);

            // next_game_id sekarang 1
            assert_eq(game::get_next_game_id(&house), 1);

            clock::destroy_for_testing(clock);
            ts::return_shared(house);
            ts::return_to_sender(&scenario, cap);
        };

        // Verifikasi game terbuat sebagai shared object
        ts::next_tx(&mut scenario, OWNER);
        {
            let game = ts::take_shared<Game>(&scenario);
            assert_eq(game::get_game_id(&game), 0);
            assert_eq(game::get_state(&game), 0); // STATE_OPEN
            assert_eq(game::get_total_pool(&game), 2_000_000_000);
            assert_eq(game::get_crewmates_pool(&game), 1_000_000_000);
            assert_eq(game::get_impostors_pool(&game), 1_000_000_000);
            ts::return_shared(game);
        };

        ts::end(scenario);
    }

    // ═══════════════════════════════════════════════════════════
    // TEST 3: Place Bet — user pasang taruhan
    // ═══════════════════════════════════════════════════════════
    #[test]
    fun test_place_bet_happy() {
        let mut scenario = ts::begin(OWNER);
        setup_game(&mut scenario);

        // Owner buat game
        ts::next_tx(&mut scenario, OWNER);
        {
            let mut house = ts::take_shared<HousePool>(&scenario);
            let cap = ts::take_from_sender<AdminCap>(&scenario);
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clock, 0);

            game::seed_pool(
                &cap, &mut house,
                1_000_000_000, 1_000_000_000,
                &clock, ts::ctx(&mut scenario),
            );

            clock::destroy_for_testing(clock);
            ts::return_shared(house);
            ts::return_to_sender(&scenario, cap);
        };

        // Alice bet 0.01 ONE ke Crewmates
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut game = ts::take_shared<Game>(&scenario);
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));

            let payment = sui::coin::mint_for_testing<sui::sui::SUI>(
                10_000_000, // 0.01 ONE
                ts::ctx(&mut scenario)
            );

            game::place_bet(
                &mut game,
                0, // TEAM_CREWMATES
                payment,
                &clock,
                ts::ctx(&mut scenario),
            );

            // Verifikasi bet tersimpan
            assert!(game::has_bet(&game, ALICE));
            assert_eq(game::get_bet_amount(&game, ALICE), 10_000_000);
            assert_eq(game::get_bet_team(&game, ALICE), 0);

            clock::destroy_for_testing(clock);
            ts::return_shared(game);
        };

        ts::end(scenario);
    }

    // ═══════════════════════════════════════════════════════════
    // TEST 4: Bet di bawah minimum harus gagal
    // ═══════════════════════════════════════════════════════════
    #[test]
    #[expected_failure(abort_code = among_nads::game::E_BET_TOO_SMALL)]
    fun test_place_bet_below_minimum_fails() {
        let mut scenario = ts::begin(OWNER);
        setup_game(&mut scenario);

        ts::next_tx(&mut scenario, OWNER);
        {
            let mut house = ts::take_shared<HousePool>(&scenario);
            let cap = ts::take_from_sender<AdminCap>(&scenario);
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clock, 0);
            game::seed_pool(&cap, &mut house, 1_000_000_000, 1_000_000_000,
                &clock, ts::ctx(&mut scenario));
            clock::destroy_for_testing(clock);
            ts::return_shared(house);
            ts::return_to_sender(&scenario, cap);
        };

        ts::next_tx(&mut scenario, ALICE);
        {
            let mut game = ts::take_shared<Game>(&scenario);
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));

            // 100 MIST = jauh di bawah MIN_BET (1_000_000 MIST)
            let payment = sui::coin::mint_for_testing<sui::sui::SUI>(100, ts::ctx(&mut scenario));
            game::place_bet(&mut game, 0, payment, &clock, ts::ctx(&mut scenario));

            clock::destroy_for_testing(clock);
            ts::return_shared(game);
        };

        ts::end(scenario);
    }

    // ═══════════════════════════════════════════════════════════
    // TEST 5: Double bet harus gagal
    // ═══════════════════════════════════════════════════════════
    #[test]
    #[expected_failure(abort_code = among_nads::game::E_ALREADY_BET)]
    fun test_place_bet_duplicate_fails() {
        let mut scenario = ts::begin(OWNER);
        setup_game(&mut scenario);

        ts::next_tx(&mut scenario, OWNER);
        {
            let mut house = ts::take_shared<HousePool>(&scenario);
            let cap = ts::take_from_sender<AdminCap>(&scenario);
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clock, 0);
            game::seed_pool(&cap, &mut house, 1_000_000_000, 1_000_000_000,
                &clock, ts::ctx(&mut scenario));
            clock::destroy_for_testing(clock);
            ts::return_shared(house);
            ts::return_to_sender(&scenario, cap);
        };

        // Alice bet pertama kali — berhasil
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut game = ts::take_shared<Game>(&scenario);
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            let payment = sui::coin::mint_for_testing<sui::sui::SUI>(10_000_000, ts::ctx(&mut scenario));
            game::place_bet(&mut game, 0, payment, &clock, ts::ctx(&mut scenario));
            clock::destroy_for_testing(clock);
            ts::return_shared(game);
        };

        // Alice bet kedua kali — harus gagal
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut game = ts::take_shared<Game>(&scenario);
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            let payment = sui::coin::mint_for_testing<sui::sui::SUI>(10_000_000, ts::ctx(&mut scenario));
            game::place_bet(&mut game, 1, payment, &clock, ts::ctx(&mut scenario));
            clock::destroy_for_testing(clock);
            ts::return_shared(game);
        };

        ts::end(scenario);
    }

    // ═══════════════════════════════════════════════════════════
    // TEST 6: Full flow — Impostor menang, Bob claim payout
    // ═══════════════════════════════════════════════════════════
    #[test]
    fun test_full_flow_impostors_win() {
        let mut scenario = ts::begin(OWNER);
        setup_game(&mut scenario);

        // Setup game dengan seed 1 ONE per tim
        ts::next_tx(&mut scenario, OWNER);
        {
            let mut house = ts::take_shared<HousePool>(&scenario);
            let cap = ts::take_from_sender<AdminCap>(&scenario);
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clock, 0);
            game::seed_pool(&cap, &mut house, 1_000_000_000, 1_000_000_000,
                &clock, ts::ctx(&mut scenario));
            clock::destroy_for_testing(clock);
            ts::return_shared(house);
            ts::return_to_sender(&scenario, cap);
        };

        // Alice bet 0.1 ONE ke Crewmates
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut game = ts::take_shared<Game>(&scenario);
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            let payment = sui::coin::mint_for_testing<sui::sui::SUI>(100_000_000, ts::ctx(&mut scenario));
            game::place_bet(&mut game, 0, payment, &clock, ts::ctx(&mut scenario));
            clock::destroy_for_testing(clock);
            ts::return_shared(game);
        };

        // Bob bet 0.05 ONE ke Impostors
        ts::next_tx(&mut scenario, BOB);
        {
            let mut game = ts::take_shared<Game>(&scenario);
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            let payment = sui::coin::mint_for_testing<sui::sui::SUI>(50_000_000, ts::ctx(&mut scenario));
            game::place_bet(&mut game, 1, payment, &clock, ts::ctx(&mut scenario));
            clock::destroy_for_testing(clock);
            ts::return_shared(game);
        };

        // Lock game
        ts::next_tx(&mut scenario, OWNER);
        {
            let mut game = ts::take_shared<Game>(&scenario);
            let cap = ts::take_from_sender<AdminCap>(&scenario);
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            game::lock_game(&cap, &mut game, &clock);
            assert_eq(game::get_state(&game), 1); // STATE_LOCKED
            clock::destroy_for_testing(clock);
            ts::return_shared(game);
            ts::return_to_sender(&scenario, cap);
        };

        // Settle: Impostors menang
        ts::next_tx(&mut scenario, OWNER);
        {
            let mut game = ts::take_shared<Game>(&scenario);
            let mut house = ts::take_shared<HousePool>(&scenario);
            let cap = ts::take_from_sender<AdminCap>(&scenario);
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            game::settle_game(
                &cap, &mut game, &mut house,
                1, // TEAM_IMPOSTORS
                &clock, ts::ctx(&mut scenario),
            );
            assert_eq(game::get_state(&game), 2); // STATE_SETTLED
            clock::destroy_for_testing(clock);
            ts::return_shared(game);
            ts::return_shared(house);
            ts::return_to_sender(&scenario, cap);
        };

        // Bob klaim payout (menang)
        ts::next_tx(&mut scenario, BOB);
        {
            let mut game = ts::take_shared<Game>(&scenario);
            game::claim_payout(&mut game, ts::ctx(&mut scenario));
            // Bob sudah diklaim
            assert!(game::is_bet_claimed(&game, BOB));
            ts::return_shared(game);
        };

        // Alice claim payout (kalah — tidak dapat apa-apa)
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut game = ts::take_shared<Game>(&scenario);
            game::claim_payout(&mut game, ts::ctx(&mut scenario));
            assert!(game::is_bet_claimed(&game, ALICE));
            ts::return_shared(game);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_cancel_and_refund() {
        let mut scenario = ts::begin(OWNER);
        setup_game(&mut scenario);

        ts::next_tx(&mut scenario, OWNER);
        {
            let mut house = ts::take_shared<HousePool>(&scenario);
            let cap = ts::take_from_sender<AdminCap>(&scenario);
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clock, 0);
            game::seed_pool(&cap, &mut house, 1_000_000_000, 1_000_000_000,
                &clock, ts::ctx(&mut scenario));
            clock::destroy_for_testing(clock);
            ts::return_shared(house);
            ts::return_to_sender(&scenario, cap);
        };

        // Alice bet
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut game = ts::take_shared<Game>(&scenario);
            let clock = clock::create_for_testing(ts::ctx(&mut scenario));
            let payment = sui::coin::mint_for_testing<sui::sui::SUI>(50_000_000, ts::ctx(&mut scenario));
            game::place_bet(&mut game, 0, payment, &clock, ts::ctx(&mut scenario));
            clock::destroy_for_testing(clock);
            ts::return_shared(game);
        };

        // Owner cancel game
        ts::next_tx(&mut scenario, OWNER);
        {
            let mut game = ts::take_shared<Game>(&scenario);
            let mut house = ts::take_shared<HousePool>(&scenario);
            let cap = ts::take_from_sender<AdminCap>(&scenario);
            game::cancel_game(&cap, &mut game, &mut house);
            assert_eq(game::get_state(&game), 3); // STATE_CANCELLED
            ts::return_shared(game);
            ts::return_shared(house);
            ts::return_to_sender(&scenario, cap);
        };

        // Alice klaim refund
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut game = ts::take_shared<Game>(&scenario);
            game::claim_refund(&mut game, ts::ctx(&mut scenario));
            assert!(game::is_bet_claimed(&game, ALICE));
            ts::return_shared(game);
        };

        ts::end(scenario);
    }
}