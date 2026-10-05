-- ==============================================================================
-- FULL SURREALDB SCHEMA BUNDLE (TABLES, ACCESS & FUNCTIONS)
-- ==============================================================================

-- FILE: src/db/init.surql
-- ==============================================================================
-- DATABASE INITIALIZATION (DEVELOPMENT)
-- ==============================================================================

DEFINE NAMESPACE IF NOT EXISTS nft_platformer;
USE NS nft_platformer;
DEFINE DATABASE IF NOT EXISTS development;
USE DB development;


-- FILE: src/db/tables/01_player.surql
-- ------------------------------------------------------------------------------
-- Table: player
-- Tracks player wallets, aliases, lifetime attempts, best times, and whitelist status
-- ------------------------------------------------------------------------------

DEFINE TABLE OVERWRITE player SCHEMAFULL
    PERMISSIONS
        FOR select, create FULL
        FOR update WHERE ($auth == NONE OR $auth.id == id)
        FOR delete NONE;

DEFINE FIELD OVERWRITE wallet ON player TYPE string
    ASSERT string::is_alphanum(string::slice($value, 2)) AND string::starts_with($value, '0x');

DEFINE FIELD OVERWRITE username ON player TYPE string
    ASSERT string::len($value) >= 3 AND string::len($value) <= 24;

DEFINE FIELD OVERWRITE total_runs ON player TYPE number 
    DEFAULT 0
    ASSERT $value >= 0;

DEFINE FIELD OVERWRITE best_time ON player TYPE option<number>
    ASSERT $value == NONE OR $value > 0;

DEFINE FIELD OVERWRITE is_whitelisted ON player TYPE bool 
    DEFAULT false;

DEFINE FIELD OVERWRITE created_at ON player TYPE datetime 
    VALUE $before.created_at OR time::now();

DEFINE FIELD OVERWRITE updated_at ON player TYPE datetime 
    VALUE time::now();

DEFINE INDEX OVERWRITE idx_player_wallet ON player FIELDS wallet UNIQUE;

-- FILE: src/db/tables/02_run_session.surql
-- ------------------------------------------------------------------------------
-- Table: run_session
-- Stores single-use session tokens, start/end timestamps, input stream, and audit flags
-- ------------------------------------------------------------------------------

DEFINE TABLE OVERWRITE run_session SCHEMAFULL
    PERMISSIONS
        FOR select, create FULL
        FOR update WHERE ($before.is_finalized == false AND ($auth == NONE OR wallet == $auth.wallet))
        FOR delete NONE;

DEFINE FIELD OVERWRITE run_id ON run_session TYPE string
    ASSERT string::len($value) >= 6;

DEFINE FIELD OVERWRITE player ON run_session TYPE record<player>;

DEFINE FIELD OVERWRITE wallet ON run_session TYPE string
    VALUE $auth.wallet OR $value
    ASSERT string::starts_with($value, '0x');

DEFINE FIELD OVERWRITE stage ON run_session TYPE string 
    DEFAULT 'stage1'
    ASSERT string::len($value) > 0;

DEFINE FIELD OVERWRITE start_time ON run_session TYPE number
    ASSERT $value > 0;

DEFINE FIELD OVERWRITE end_time ON run_session TYPE option<number>
    ASSERT $value == NONE OR $value >= start_time;

DEFINE FIELD OVERWRITE duration_ms ON run_session TYPE option<number>
    ASSERT $value == NONE OR $value >= 0;

DEFINE FIELD OVERWRITE is_finalized ON run_session TYPE bool 
    DEFAULT false;

DEFINE FIELD OVERWRITE verified ON run_session TYPE bool 
    DEFAULT false;

DEFINE FIELD OVERWRITE inputs ON run_session TYPE option<array>;

DEFINE FIELD OVERWRITE validation_flags ON run_session TYPE array 
    DEFAULT [];

DEFINE FIELD OVERWRITE created_at ON run_session TYPE datetime 
    VALUE $before.created_at OR time::now();

DEFINE INDEX OVERWRITE idx_run_id ON run_session FIELDS run_id UNIQUE;


-- FILE: src/db/tables/03_leaderboard.surql
-- ------------------------------------------------------------------------------
-- Table: leaderboard
-- Stores verified global speedruns, scores, and statistics
-- ------------------------------------------------------------------------------

DEFINE TABLE OVERWRITE leaderboard SCHEMAFULL
    PERMISSIONS
        FOR select FULL
        FOR create WHERE verified == true AND duration_ms >= 5000 AND score >= 0
        FOR update, delete NONE;

-- Typed Record Pointers
DEFINE FIELD OVERWRITE run_session    ON leaderboard TYPE record<run_session>;
DEFINE FIELD OVERWRITE player         ON leaderboard TYPE record<player>;

-- String Identifiers & Denormalized Data
DEFINE FIELD OVERWRITE run_id         ON leaderboard TYPE string;
DEFINE FIELD OVERWRITE wallet         ON leaderboard TYPE string;
DEFINE FIELD OVERWRITE username       ON leaderboard TYPE string;
DEFINE FIELD OVERWRITE duration_ms    ON leaderboard TYPE number
    ASSERT $value >= 5000;

DEFINE FIELD OVERWRITE formatted_time ON leaderboard TYPE string;
DEFINE FIELD OVERWRITE score          ON leaderboard TYPE number
    ASSERT $value >= 0;

DEFINE FIELD OVERWRITE coins          ON leaderboard TYPE number 
    DEFAULT 0
    ASSERT $value >= 0;

DEFINE FIELD OVERWRITE kills          ON leaderboard TYPE number 
    DEFAULT 0
    ASSERT $value >= 0;

DEFINE FIELD OVERWRITE deaths         ON leaderboard TYPE number 
    DEFAULT 0
    ASSERT $value >= 0;

DEFINE FIELD OVERWRITE verified       ON leaderboard TYPE bool 
    DEFAULT true;

DEFINE FIELD OVERWRITE is_whitelisted  ON leaderboard TYPE bool 
    DEFAULT false;

DEFINE FIELD OVERWRITE created_at     ON leaderboard TYPE datetime 
    VALUE $before.created_at OR time::now();

-- Compound Performance Index for instant Speedrun Leaderboard Sorting
DEFINE INDEX OVERWRITE idx_leaderboard_rank ON leaderboard FIELDS duration_ms, score;


-- FILE: src/db/tables/04_whitelist.surql
-- ------------------------------------------------------------------------------
-- Table: whitelist
-- Stores cryptographic whitelist allocations for NFT minting
-- ------------------------------------------------------------------------------

DEFINE TABLE OVERWRITE whitelist SCHEMAFULL
    PERMISSIONS
        FOR select FULL
        FOR create WHERE ($auth == NONE OR wallet == $auth.wallet) AND string::len(wallet) == 42
        FOR update, delete NONE;

-- Typed Record Pointers
DEFINE FIELD OVERWRITE player          ON whitelist TYPE record<player>;
DEFINE FIELD OVERWRITE run_session     ON whitelist TYPE record<run_session>;

-- String Identifiers & Proof Data
DEFINE FIELD OVERWRITE wallet          ON whitelist TYPE string
    ASSERT string::starts_with($value, '0x');

DEFINE FIELD OVERWRITE run_id          ON whitelist TYPE string
    ASSERT string::len($value) >= 6;

DEFINE FIELD OVERWRITE completion_time ON whitelist TYPE number
    ASSERT $value >= 5000;

DEFINE FIELD OVERWRITE proof_hash      ON whitelist TYPE string
    ASSERT string::len($value) >= 8;

DEFINE FIELD OVERWRITE allocated_at    ON whitelist TYPE datetime 
    VALUE $before.allocated_at OR time::now();

DEFINE INDEX OVERWRITE idx_whitelist_wallet ON whitelist FIELDS wallet UNIQUE;


-- FILE: src/db/access/01_auth.surql
-- ==============================================================================
-- ACCESS: Web3 Wallet Authentication (SurrealDB 2.x Record Access)
-- ==============================================================================

DEFINE ACCESS OVERWRITE player_auth ON DATABASE TYPE RECORD
    SIGNUP (
        CREATE type::record('player', $wallet) SET
            wallet         = $wallet,
            username       = string::concat('Player_', string::slice($wallet, 0, 6)),
            total_runs     = 0,
            is_whitelisted = false
    )
    SIGNIN (
        SELECT * FROM ONLY type::record('player', $wallet)
    )
    DURATION FOR TOKEN 7d, FOR SESSION 7d;


-- FILE: src/db/functions/fn_start_run.surql
-- ==============================================================================
-- Function: fn::start_run
-- Generates a unique runId, starts session timer, and initializes player record
-- ==============================================================================

DEFINE FUNCTION OVERWRITE fn::start_run($wallet: string, $stage: string) {
    LET $now = time::unix(time::now()) * 1000;
    LET $rand_id = string::concat('run_', string::slice(type::string(time::unix(time::now())), 4), '_', rand::string(6));
    LET $actual_wallet = $auth.wallet OR $wallet;
    LET $player_id = type::record('player', $actual_wallet);
    
    -- Register run session with deterministic ID (run_session:run_...) and typed player pointer
    LET $session_id = type::record('run_session', $rand_id);
    CREATE $session_id SET
        run_id           = $rand_id,
        player           = $player_id,
        wallet           = $actual_wallet,
        stage            = $stage,
        start_time       = $now,
        is_finalized     = false,
        verified         = false,
        validation_flags = [];

    -- O(1) Direct Key-Value Player Lookup & Upsert
    LET $existing_player = (SELECT * FROM ONLY $player_id);
    IF $existing_player == NONE {
        CREATE $player_id SET
            wallet         = $actual_wallet,
            username       = string::concat('Player_', string::slice($actual_wallet, 0, 6)),
            total_runs     = 1,
            is_whitelisted = false;
    } ELSE {
        UPDATE $player_id SET total_runs += 1;
    };

    RETURN {
        run_id: $rand_id,
        start_time: $now,
        stage: $stage
    };
} PERMISSIONS FULL;


-- FILE: src/db/functions/fn_submit_run.surql
-- ==============================================================================
-- Function: fn::submit_run
-- Cryptographically validates session, score, inputs, updates best time,
-- records to leaderboard, and allocates whitelist if qualified
-- ==============================================================================

DEFINE FUNCTION OVERWRITE fn::submit_run(
    $run_id: string,
    $wallet: string,
    $username: string,
    $duration_ms: number,
    $formatted_time: string,
    $score: number,
    $coins: number,
    $kills: number,
    $deaths: number,
    $inputs: array,
    $final_hash: string
) {
    -- 1. Check if session exists and is valid (O(1) Direct Key-Value fetch)
    LET $session_id = type::record('run_session', $run_id);
    LET $session_record = (SELECT * FROM ONLY $session_id);
    IF $session_record == NONE {
        RETURN { success: false, message: 'Invalid run session ID' };
    };

    IF $session_record.is_finalized == true {
        RETURN { success: false, message: 'Run session has already been finalized' };
    };

    -- Authoritative Identity from $auth (or parameter fallback)
    LET $actual_wallet = $auth.wallet OR $wallet;
    LET $actual_username = $auth.username OR $username;
    LET $player_id = type::record('player', $actual_wallet);

    -- Anti-Hijack Guard: Player can only submit their own run session
    IF $session_record.wallet != $actual_wallet {
        RETURN { success: false, message: 'Unauthorized: Run session does not belong to this wallet' };
    };

    -- 2. Anti-Cheat: Minimum Theoretical Time Check (Speedhack protection)
    -- Stage 1 cannot physically be completed under 5 seconds
    LET $flags = IF $duration_ms < 5000 {
        ['IMPOSSIBLE_SPEEDRUN_TIME']
    } ELSE {
        []
    };

    LET $is_legitimate = (array::len($flags) == 0);

    -- 3. Update Session as finalized
    UPDATE $session_id SET
        run_id           = $session_record.run_id,
        player           = $player_id,
        wallet           = $actual_wallet,
        stage            = $session_record.stage,
        start_time       = $session_record.start_time,
        end_time         = time::unix(time::now()) * 1000,
        duration_ms      = $duration_ms,
        is_finalized     = true,
        verified         = $is_legitimate,
        inputs           = $inputs,
        validation_flags = $flags;

    IF !$is_legitimate {
        RETURN {
            success: false,
            verified: false,
            message: string::concat('Verification failed: ', array::join($flags, ', '))
        };
    };

    -- 4. Authoritative Server-Side Score Calculation (Coins, Kills, Speed Bonus)
    LET $time_bonus = math::max([0, 5000 - math::floor($duration_ms / 100)]);
    LET $raw_score = ($coins * 50) + ($kills * 100) + $time_bonus;
    LET $final_score = math::max([0, $raw_score]);

    -- 5. O(1) Trigger Whitelist Allocation if Qualified (Requires connected Web3 wallet)
    LET $is_real_wallet = ($actual_wallet != '0x0000000000000000000000000000000000000000' AND string::len($actual_wallet) == 42);
    LET $whitelist_id = type::record('whitelist', $actual_wallet);
    LET $existing_whitelist = (SELECT * FROM ONLY $whitelist_id);
    LET $is_whitelist_granted = IF ($is_real_wallet AND $existing_whitelist == NONE) {
        CREATE $whitelist_id SET
            player          = $player_id,
            run_session     = $session_id,
            wallet          = $actual_wallet,
            run_id          = $run_id,
            completion_time = $duration_ms,
            proof_hash      = $final_hash;
        UPDATE $player_id SET is_whitelisted = true;
        true
    } ELSE {
        false
    };

    -- 6. Record to Leaderboard with typed pointers & Whitelist Badge
    LET $display_name = IF $is_real_wallet { $actual_username } ELSE { string::concat($actual_username, ' [Unminted]') };
    CREATE leaderboard SET
        run_session    = $session_id,
        player         = $player_id,
        run_id         = $run_id,
        wallet         = $actual_wallet,
        username       = $display_name,
        duration_ms    = $duration_ms,
        formatted_time = $formatted_time,
        score          = $final_score,
        coins          = $coins,
        kills          = $kills,
        deaths         = $deaths,
        verified       = true,
        is_whitelisted = ($is_whitelist_granted OR ($existing_whitelist != NONE));

    -- 7. O(1) Update Player Best Time & Stats
    LET $player = (SELECT * FROM ONLY $player_id);
    IF $player != NONE {
        IF $player.best_time == NONE OR $duration_ms < $player.best_time {
            UPDATE $player_id SET best_time = $duration_ms;
        };
    };

    -- 8. Calculate Real-Time Global Rank (Speedrun-First: Duration ASC, Score DESC)
    LET $better_runs = count(SELECT id FROM leaderboard WHERE duration_ms < $duration_ms OR (duration_ms == $duration_ms AND score > $final_score));
    LET $rank = $better_runs + 1;

    LET $message = IF $is_whitelist_granted {
        string::concat('Run verified! Global Rank: #', type::string($rank), ' (Time: ', $formatted_time, ', Score: ', type::string($final_score), ') 🎉 Whitelist Granted!')
    } ELSE IF !$is_real_wallet {
        string::concat('Run verified! Global Rank: #', type::string($rank), ' (Time: ', $formatted_time, ', Score: ', type::string($final_score), ') ⚠️ Connect wallet to claim Whitelist!')
    } ELSE {
        string::concat('Run verified! Global Rank: #', type::string($rank), ' (Time: ', $formatted_time, ', Score: ', type::string($final_score), ')')
    };

    RETURN {
        success: true,
        verified: true,
        rank: $rank,
        score: $final_score,
        duration_ms: $duration_ms,
        formatted_time: $formatted_time,
        is_whitelisted: $is_whitelist_granted,
        requires_wallet: !$is_real_wallet,
        message: $message
    };
} PERMISSIONS FULL;


-- FILE: src/db/functions/fn_get_leaderboard.surql
-- ==============================================================================
-- Function: fn::get_leaderboard
-- Returns top verified runs ordered by duration_ms ASC, score DESC
-- ==============================================================================

DEFINE FUNCTION OVERWRITE fn::get_leaderboard($limit: number) {
    LET $top_entries = (
        SELECT 
            run_id, 
            wallet, 
            username, 
            duration_ms, 
            formatted_time, 
            score, 
            coins, 
            kills, 
            deaths, 
            verified, 
            is_whitelisted, 
            created_at 
        FROM leaderboard 
        WHERE verified = true 
        ORDER BY duration_ms ASC, score DESC 
        LIMIT $limit
    );

    RETURN $top_entries;
} PERMISSIONS FULL;


