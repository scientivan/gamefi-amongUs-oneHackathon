

module among_nads::game {
    use sui::coin::Coin;
    use sui::balance::Balance;
    use sui::table::Table;
    use sui::clock::Clock;

    use one::oct::OCT;

    /// min bet 0.001 SUI
    const MIN_BET: u64 = 1_000_000;

    /// max bet: 0.1 SUI
    const MAX_BET: u64 = 100_000_000;

    /// Protocol fee: 0.1% (10 basis points dari 10_000)
    const FEE_BPS: u64 = 10;
    const BPS_DENOM: u64 = 10_000;

    /// Durasi lobby default: 
    const DEFAULT_LOBBY_DURATION_MS: u64 = 180_000;

    /// Settlement timeout default: 
    const DEFAULT_SETTLEMENT_TIMEOUT_MS: u64 = 3_600_000;

    // Tim { Crewmates, Impostors }
    const TEAM_CREWMATES: u8 = 0;


    // State game 
    const STATE_OPEN: u8      = 0; // open bit 
    const STATE_LOCKED: u8    = 1; // Betting close, game start
    const STATE_SETTLED: u8   = 2; // end game 
    const STATE_CANCELLED: u8 = 3; // game cancel 

    

    /// BetBelowMinimum
    const E_BET_TOO_SMALL: u64 = 2;

    /// BetExceedsMaximum
    const E_BET_TOO_BIG: u64 = 3;

    /// AlreadyBet
    const E_ALREADY_BET: u64 = 4;

    /// InvalidGameState
    const E_INVALID_STATE: u64 = 5;

    /// BettingDeadlinePassed
    const E_DEADLINE_PASSED: u64 = 6;

    /// NoBetToClaim
    const E_NOTHING_TO_CLAIM: u64 = 7;

    /// AlreadyClaimed
    const E_ALREADY_CLAIMED: u64 = 8;

    /// InsufficientHouseBalance
    const E_INSUFFICIENT_HOUSE: u64 = 9;

    /// GameNotCancelled
    const E_NOT_CANCELLED: u64 = 10;

    /// SettlementTimeoutNotReached
    const E_TIMEOUT_NOT_REACHED: u64 = 11;

    /// InvalidDuration
    const E_INVALID_DURATION: u64 = 12;

    /// TransferFailed (tidak bisa terjadi di Move)
    const E_ZERO_PAYOUT: u64 = 13;

    /// Minimum vote fee: 0.001 OCT
    const VOTE_FEE: u64 = 1_000_000;


    public struct AdminCap has key, store {
        id: UID,
    }

    public struct HousePool has key {
        id: UID,
        /// uint256 public houseBalance
        balance: Balance<OCT>,
        /// uint256 public nextGameId
        next_game_id: u64,
        /// address owner
        owner: address,
        /// uint256 public lobbyDuration 
        lobby_duration_ms: u64,
        /// uint256 public settlementTimeout
        settlement_timeout_ms: u64,
    }

    public struct Game has key {
        id: UID,

        /// uint256 id
        game_id: u64,

        /// GameState state
        /// 0=Open, 1=Locked, 2=Settled, 3=Cancelled
        state: u8,

        /// uint256 bettingDeadline
        betting_deadline_ms: u64,

        /// uint256 totalPool
        total_pool: u64,

        /// uint256 crewmatesPool
        crewmates_pool: Balance<OCT>,

        /// uint256 impostorsPool
        impostors_pool: Balance<OCT>,

        /// uint256 crewmatesSeed
        crewmates_seed: u64,

        /// uint256 impostorsSeed
        impostors_seed: u64,

        /// Team winningTeam
        winning_team: u8,

        /// mapping(address => Bet)
        bets: Table<address, Bet>,

        /// Deadline dalam ms untuk cancel by timeout
        lock_timestamp_ms: u64,

        /// Winning pool size sebelum house return diambil
        winning_pool_at_settlement: u64,
    }

    /// Bet — pengganti struct Bet di Solidity
    public struct Bet has store {
        team: u8,
        amount: u64,
        claimed: bool,
    }

    /// GameResultNFT — FITUR BARU
    public struct GameResultNFT has key, store {
        id: UID,
        game_id: u64,
        winning_team: u8,
        total_pool: u64,
        timestamp_ms: u64,
    }

    /// event GameCreated(uint256 indexed gameId, uint256 bettingDeadline)
    public struct EvGameCreated has copy, drop {
        game_id: u64,
        deadline_ms: u64,
    }

    /// event BetPlaced(uint256 indexed gameId, address indexed bettor, Team team, uint256 amount)
    public struct EvBetPlaced has copy, drop {
        game_id: u64,
        bettor: address,
        team: u8,
        amount: u64,
    }

    /// event GameLocked(uint256 indexed gameId)
    public struct EvGameLocked has copy, drop {
        game_id: u64,
    }

    /// event GameSettled(uint256 indexed gameId, Team winningTeam)
    public struct EvGameSettled has copy, drop {
        game_id: u64,
        winning_team: u8,
        total_pool: u64,
        fee_collected: u64,
    }

    /// event PayoutClaimed(uint256 indexed gameId, address indexed bettor, uint256 amount)
    public struct EvPayoutClaimed has copy, drop {
        game_id: u64,
        bettor: address,
        amount: u64,
    }

    /// event Deposited(uint256 amount)
    public struct EvDeposited has copy, drop {
        amount: u64,
        new_balance: u64,
    }

    /// event PoolSeeded(uint256 indexed gameId, uint256 crewAmount, uint256 impAmount)
    public struct EvPoolSeeded has copy, drop {
        game_id: u64,
        crew_seed: u64,
        imp_seed: u64,
    }

    /// event Swept(uint256 amount)
    public struct EvSwept has copy, drop {
        amount: u64,
        remaining_balance: u64,
    }

    /// event GameCancelled(uint256 indexed gameId)
    public struct EvGameCancelled has copy, drop {
        game_id: u64,
    }

    /// event RefundClaimed(uint256 indexed gameId, address indexed bettor, uint256 amount)
    public struct EvRefundClaimed has copy, drop {
        game_id: u64,
        bettor: address,
        amount: u64,
    }

    /// event LobbyDurationUpdated
    public struct EvLobbyDurationUpdated has copy, drop {
        new_duration_ms: u64,
    }

    /// event SettlementTimeoutUpdated
    public struct EvSettlementTimeoutUpdated has copy, drop {
        new_timeout_ms: u64,
    }

    /// event VoteCast — emitted when a player votes on a game event
    public struct EvVoteCast has copy, drop {
        game_id: u64,
        voter: address,
        vote_type: u8,   // 0=Emergency Meeting, 1=Sabotage, 2=Report Body, 3=Vote Out
        fee_amount: u64,
    }


    fun init(ctx: &mut TxContext) {
        let sender = sui::tx_context::sender(ctx);


        // __Ownable_init(initialOwner)
        let admin_cap = AdminCap {
            id: sui::object::new(ctx),
        };
        sui::transfer::transfer(admin_cap, sender);

        // state variables di contract
        let house_pool = HousePool {
            id: sui::object::new(ctx),
            balance: sui::balance::zero<OCT>(),
            next_game_id: 0,
            owner: sender,
            lobby_duration_ms: DEFAULT_LOBBY_DURATION_MS,
            settlement_timeout_ms: DEFAULT_SETTLEMENT_TIMEOUT_MS,
        };
        // share_object 
        sui::transfer::share_object(house_pool);
    }

    public fun deposit(
        _cap: &AdminCap,                  // = onlyOwner
        house: &mut HousePool,
        payment: Coin<OCT>,               // = msg.value
    ) {
        let amount = sui::coin::value(&payment);
        sui::balance::join(&mut house.balance, sui::coin::into_balance(payment));

        sui::event::emit(EvDeposited {
            amount,
            new_balance: sui::balance::value(&house.balance),
        });
    }

    public fun seed_pool(
        _cap: &AdminCap,
        house: &mut HousePool,
        crew_seed: u64,
        imp_seed: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let total = crew_seed + imp_seed;

        // if (houseBalance < total) revert InsufficientHouseBalance(...)
        assert!(sui::balance::value(&house.balance) >= total, E_INSUFFICIENT_HOUSE);

        // Auto-increment game ID
        // lazy creation dengan nextGameId check
        let game_id = house.next_game_id;
        house.next_game_id = house.next_game_id + 1;

        // deadline
        let now_ms = sui::clock::timestamp_ms(clock);
        let deadline_ms = now_ms + house.lobby_duration_ms;

        // Split dari house balance
        let crew_balance = sui::balance::split(&mut house.balance, crew_seed);
        let imp_balance  = sui::balance::split(&mut house.balance, imp_seed);

        // Buat Game object baru
        // games[gameId] = Game({...})
        let game = Game {
            id: sui::object::new(ctx),
            game_id,
            state: STATE_OPEN,
            betting_deadline_ms: deadline_ms,
            total_pool: crew_seed + imp_seed,
            crewmates_pool: crew_balance,
            impostors_pool: imp_balance,
            crewmates_seed: crew_seed,
            impostors_seed: imp_seed,
            winning_team: TEAM_CREWMATES, // placeholder, diisi saat settle
            bets: sui::table::new(ctx),
            lock_timestamp_ms: 0,
            winning_pool_at_settlement: 0, // diisi saat settle_game
        };

        sui::event::emit(EvGameCreated {
            game_id,
            deadline_ms,
        });
        sui::event::emit(EvPoolSeeded {
            game_id,
            crew_seed,
            imp_seed,
        });

        sui::transfer::share_object(game);
    }


    public fun lock_game(
        _cap: &AdminCap,
        game: &mut Game,
        clock: &Clock,
    ) {
        // if (state != Open) revert InvalidGameState
        assert!(game.state == STATE_OPEN, E_INVALID_STATE);

        game.state = STATE_LOCKED;
        // Simpan timestamp lock untuk timeout calculation
        game.lock_timestamp_ms = sui::clock::timestamp_ms(clock);

        sui::event::emit(EvGameLocked {
            game_id: game.game_id,
        });
    }

    public fun settle_game(
        _cap: &AdminCap,
        game: &mut Game,
        house: &mut HousePool,
        winning_team: u8,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        // if (state != Locked) revert InvalidGameState
        assert!(game.state == STATE_LOCKED, E_INVALID_STATE);

        game.state = STATE_SETTLED;
        game.winning_team = winning_team;

        let total = game.total_pool;

        // Hitung fee 0.1%
        // uint256 fee = (game.totalPool * PROTOCOL_FEE_BPS) / 10_000
        let fee = (total * FEE_BPS) / BPS_DENOM;

        // uint256 distributable = game.totalPool - fee
        let distributable = total - fee;

        // uint256 seedInWinning = (winningTeam == Crewmates)
        //              ? crewmatesSeed : impostorsSeed
        let seed_in_winning = if (winning_team == TEAM_CREWMATES) {
            game.crewmates_seed
        } else {
            game.impostors_seed
        };

        let winning_pool_total = if (winning_team == TEAM_CREWMATES) {
            sui::balance::value(&game.crewmates_pool)
        } else {
            sui::balance::value(&game.impostors_pool)
        };

        game.winning_pool_at_settlement = winning_pool_total;

        let seed_share = if (winning_pool_total > 0) {
            (seed_in_winning * distributable) / winning_pool_total
        } else {
            distributable // tidak ada pemenang → semua ke house
        };

        // Return fee + seed share ke house
        // houseBalance += fee + seedShare
        // Di Move: Balance benar-benar dipindahkan dari pool ke house
        // Cap agar tidak melebihi 90% dari winning pool (preserve at least 10% for payouts)
        let mut house_return = fee + seed_share;
        let max_house_return = (winning_pool_total * 90) / 100;
        if (house_return > max_house_return) {
            house_return = max_house_return;
        };
        if (house_return > 0) {
            let return_balance = if (winning_team == TEAM_CREWMATES) {
                sui::balance::split(&mut game.crewmates_pool, house_return)
            } else {
                sui::balance::split(&mut game.impostors_pool, house_return)
            };
            sui::balance::join(&mut house.balance, return_balance);
        };

        sui::event::emit(EvGameSettled {
            game_id: game.game_id,
            winning_team,
            total_pool: total,
            fee_collected: fee,
        });

        // BONUS FITUR MOVE: Mint GameResult NFT
        // Tidak ada di Solidity — fitur eksklusif Move!
        let nft = GameResultNFT {
            id: sui::object::new(ctx),
            game_id: game.game_id,
            winning_team,
            total_pool: total,
            timestamp_ms: sui::clock::timestamp_ms(clock),
        };
        // Kirim NFT ke owner sebagai collectible
        sui::transfer::public_transfer(nft, house.owner);
    }

    /// Batalkan game (owner)
    ///
    /// Pengganti:
    ///   function cancelGame(uint256 gameId) external override onlyOwner {
    ///     GameState state = games[gameId].state;
    ///     if (state != Open && state != Locked)
    ///       revert InvalidGameState(gameId, state);
    ///     _cancelGame(gameId);
    ///   }
    public fun cancel_game(
        _cap: &AdminCap,
        game: &mut Game,
        house: &mut HousePool,
    ) {
        assert!(
            game.state == STATE_OPEN || game.state == STATE_LOCKED,
            E_INVALID_STATE
        );
        internal_cancel_game(game, house);
    }


    public fun cancel_game_by_timeout(
        game: &mut Game,
        house: &mut HousePool,
        clock: &Clock,
    ) {
        // if (state != Locked) revert
        assert!(game.state == STATE_LOCKED, E_INVALID_STATE);

        // if (block.timestamp <= bettingDeadline + settlementTimeout)
        let now_ms      = sui::clock::timestamp_ms(clock);
        let timeout_end = game.lock_timestamp_ms + house.settlement_timeout_ms;
        assert!(now_ms > timeout_end, E_TIMEOUT_NOT_REACHED);

        internal_cancel_game(game, house);
    }

    public fun sweep(
        _cap: &AdminCap,
        house: &mut HousePool,
        amount: u64,
        ctx: &mut TxContext,
    ) {
        // if (houseBalance < amount) revert InsufficientHouseBalance
        assert!(sui::balance::value(&house.balance) >= amount, E_INSUFFICIENT_HOUSE);

        let withdrawn = sui::balance::split(&mut house.balance, amount);
        let coin = sui::coin::from_balance(withdrawn, ctx);

        // owner().call{ value: amount }("")
        sui::transfer::public_transfer(coin, house.owner);

        sui::event::emit(EvSwept {
            amount,
            remaining_balance: sui::balance::value(&house.balance),
        });
    }

    // ── Config ──────────────────────────────────────────────────

    /// function setLobbyDuration(uint256 newDuration)
    public fun set_lobby_duration(
        _cap: &AdminCap,
        house: &mut HousePool,
        new_duration_ms: u64,
    ) {
        assert!(new_duration_ms > 0, E_INVALID_DURATION);
        house.lobby_duration_ms = new_duration_ms;
        sui::event::emit(EvLobbyDurationUpdated { new_duration_ms });
    }

    /// function setSettlementTimeout(uint256 newTimeout)
    public fun set_settlement_timeout(
        _cap: &AdminCap,
        house: &mut HousePool,
        new_timeout_ms: u64,
    ) {
        assert!(new_timeout_ms > 0, E_INVALID_DURATION);
        house.settlement_timeout_ms = new_timeout_ms;
        sui::event::emit(EvSettlementTimeoutUpdated { new_timeout_ms });
    }


    /// Cast a vote on an active game event. Fee is added to the game pool.
    /// vote_type: 0=Emergency Meeting, 1=Sabotage, 2=Report Body, 3=Vote Out
    public fun cast_vote(
        game: &mut Game,
        vote_type: u8,
        fee: Coin<OCT>,
        ctx: &mut TxContext,
    ) {
        assert!(game.state == STATE_OPEN, E_INVALID_STATE);
        assert!(vote_type <= 3, E_INVALID_STATE);
        let fee_amount = sui::coin::value(&fee);
        assert!(fee_amount >= VOTE_FEE, E_BET_TOO_SMALL);
        let fee_balance = sui::coin::into_balance(fee);
        sui::balance::join(&mut game.crewmates_pool, fee_balance);
        game.total_pool = game.total_pool + fee_amount;
        sui::event::emit(EvVoteCast {
            game_id: game.game_id,
            voter: sui::tx_context::sender(ctx),
            vote_type,
            fee_amount,
        });
    }

    public fun place_bet(
        game: &mut Game,
        team: u8,
        payment: Coin<OCT>,               // = msg.value
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let sender = sui::tx_context::sender(ctx);
        let amount = sui::coin::value(&payment);

        // if (amount < MIN_BET) revert BetBelowMinimum
        assert!(amount >= MIN_BET, E_BET_TOO_SMALL);

        // if (amount > MAX_BET) revert BetExceedsMaximum
        assert!(amount <= MAX_BET, E_BET_TOO_BIG);

        // if (state != Open) revert InvalidGameState
        assert!(game.state == STATE_OPEN, E_INVALID_STATE);

        // if (block.timestamp > bettingDeadline)
        //              revert BettingDeadlinePassed
        assert!(
            sui::clock::timestamp_ms(clock) < game.betting_deadline_ms,
            E_DEADLINE_PASSED
        );

        // if (bets[gameId][msg.sender].bettor != address(0))
        //              revert AlreadyBet
        assert!(!sui::table::contains(&game.bets, sender), E_ALREADY_BET);

        // Simpan bet
        // bets[gameId][msg.sender] = Bet({...})
        sui::table::add(&mut game.bets, sender, Bet {
            team,
            amount,
            claimed: false,
        });

        // Masukkan ke pool yang sesuai
        // crewmatesPool += amount / impostorsPool += amount
        let bet_balance = sui::coin::into_balance(payment);
        if (team == TEAM_CREWMATES) {
            sui::balance::join(&mut game.crewmates_pool, bet_balance);
        } else {
            sui::balance::join(&mut game.impostors_pool, bet_balance);
        };

        // Update total pool
        game.total_pool = game.total_pool + amount;

        sui::event::emit(EvBetPlaced {
            game_id: game.game_id,
            bettor: sender,
            team,
            amount,
        });
    }


    public fun claim_payout(
        game: &mut Game,
        ctx: &mut TxContext,
    ) {
        let sender = sui::tx_context::sender(ctx);

        // if (state != Settled) revert InvalidGameState
        assert!(game.state == STATE_SETTLED, E_INVALID_STATE);

        // if (bet.bettor == address(0)) revert NoBetToClaim
        assert!(sui::table::contains(&game.bets, sender), E_NOTHING_TO_CLAIM);

        let bet = sui::table::borrow_mut(&mut game.bets, sender);

        // if (bet.claimed) revert AlreadyClaimed
        assert!(!bet.claimed, E_ALREADY_CLAIMED);

        bet.claimed = true;

        // if (bet.team != winningTeam) return (loser)
        if (bet.team != game.winning_team) {
            // Kalah — marked as claimed, tidak ada transfer
            return
        };


        let total       = game.total_pool;
        let fee         = (total * FEE_BPS) / BPS_DENOM;
        let distributable = total - fee;

        // Gunakan winning_pool_at_settlement yang disimpan saat settle_game
        let winning_pool_total = game.winning_pool_at_settlement;

        assert!(winning_pool_total > 0, E_ZERO_PAYOUT);

        let bet_amount = bet.amount;
        let payout = (bet_amount * distributable) / winning_pool_total;

        assert!(payout > 0, E_ZERO_PAYOUT);

        // Transfer payout ke pemenang
        // (bool ok,) = msg.sender.call{ value: payout }("")
        let payout_coin = if (game.winning_team == TEAM_CREWMATES) {
            sui::coin::from_balance(
                sui::balance::split(&mut game.crewmates_pool, payout),
                ctx
            )
        } else {
            sui::coin::from_balance(
                sui::balance::split(&mut game.impostors_pool, payout),
                ctx
            )
        };

        sui::transfer::public_transfer(payout_coin, sender);

        sui::event::emit(EvPayoutClaimed {
            game_id: game.game_id,
            bettor: sender,
            amount: payout,
        });
    }

    public fun claim_refund(
        game: &mut Game,
        ctx: &mut TxContext,
    ) {
        let sender = sui::tx_context::sender(ctx);

        // if (state != Cancelled) revert GameNotCancelled
        assert!(game.state == STATE_CANCELLED, E_NOT_CANCELLED);

        // if (bet.bettor == address(0)) revert NoBetToClaim
        assert!(sui::table::contains(&game.bets, sender), E_NOTHING_TO_CLAIM);

        let bet = sui::table::borrow_mut(&mut game.bets, sender);

        // if (bet.claimed) revert AlreadyClaimed
        assert!(!bet.claimed, E_ALREADY_CLAIMED);

        let refund_amount = bet.amount;
        let team = bet.team;
        bet.claimed = true;

        // Refund full amount
        // (bool ok,) = msg.sender.call{ value: refundAmount }("")
        let refund_coin = if (team == TEAM_CREWMATES) {
            sui::coin::from_balance(
                sui::balance::split(&mut game.crewmates_pool, refund_amount),
                ctx
            )
        } else {
            sui::coin::from_balance(
                sui::balance::split(&mut game.impostors_pool, refund_amount),
                ctx
            )
        };

        sui::transfer::public_transfer(refund_coin, sender);

        sui::event::emit(EvRefundClaimed {
            game_id: game.game_id,
            bettor: sender,
            amount: refund_amount,
        });
    }


    /// function _cancelGame(uint256 gameId) internal
    fun internal_cancel_game(
        game: &mut Game,
        house: &mut HousePool,
    ) {
        game.state = STATE_CANCELLED;

        // Return seed ke house balance
        // houseBalance += crewmatesSeed + impostorsSeed
        let crew_seed_val = game.crewmates_seed;
        let imp_seed_val  = game.impostors_seed;

        if (crew_seed_val > 0 &&
            sui::balance::value(&game.crewmates_pool) >= crew_seed_val) {
            let seed_back = sui::balance::split(
                &mut game.crewmates_pool, crew_seed_val
            );
            sui::balance::join(&mut house.balance, seed_back);
        };

        if (imp_seed_val > 0 &&
            sui::balance::value(&game.impostors_pool) >= imp_seed_val) {
            let seed_back = sui::balance::split(
                &mut game.impostors_pool, imp_seed_val
            );
            sui::balance::join(&mut house.balance, seed_back);
        };

        sui::event::emit(EvGameCancelled { game_id: game.game_id });
    }


    /// function getGame(uint256 gameId) returns (Game memory)
    public fun get_game_id(game: &Game): u64 { game.game_id }
    public fun get_state(game: &Game): u8 { game.state }
    public fun get_total_pool(game: &Game): u64 { game.total_pool }
    public fun get_deadline(game: &Game): u64 { game.betting_deadline_ms }
    public fun get_winning_team(game: &Game): u8 { game.winning_team }
    public fun get_crewmates_pool(game: &Game): u64 {
        sui::balance::value(&game.crewmates_pool)
    }
    public fun get_impostors_pool(game: &Game): u64 {
        sui::balance::value(&game.impostors_pool)
    }

    /// function getBet() returns (Bet memory)
    public fun has_bet(game: &Game, addr: address): bool {
        sui::table::contains(&game.bets, addr)
    }
    public fun get_bet_amount(game: &Game, addr: address): u64 {
        sui::table::borrow(&game.bets, addr).amount
    }
    public fun get_bet_team(game: &Game, addr: address): u8 {
        sui::table::borrow(&game.bets, addr).team
    }
    public fun is_bet_claimed(game: &Game, addr: address): bool {
        sui::table::borrow(&game.bets, addr).claimed
    }

    /// function hasBets(uint256 gameId) returns (bool)
    public fun has_bets(game: &Game): bool {
        game.total_pool > 0
    }

    /// function hasUserBets(uint256 gameId) returns (bool)
    public fun has_user_bets(game: &Game): bool {
        game.total_pool > (game.crewmates_seed + game.impostors_seed)
    }

    /// uint256 public nextGameId
    public fun get_next_game_id(house: &HousePool): u64 {
        house.next_game_id
    }

    /// uint256 public houseBalance
    public fun get_house_balance(house: &HousePool): u64 {
        sui::balance::value(&house.balance)
    }

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx)
    }
}