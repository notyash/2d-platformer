// src/services/SurrealService.ts
import { Surreal } from 'surrealdb';
import { SecurityManager, type VerifiedRunPayload } from '../managers/SecurityManager';
import type { LeaderboardEntry } from '../managers/LeaderboardManager';

export interface SurrealRunSession {
  runId: string;
  startTime: number;
  stage: string;
}

export interface SurrealSubmitResult {
  success: boolean;
  verified: boolean;
  rank?: number;
  isWhitelisted?: boolean;
  message: string;
}

export class SurrealService {
  private static instance: SurrealService;
  private db: Surreal;
  private isConnected: boolean = false;
  private isAuthenticated: boolean = false;
  private connectPromise: Promise<boolean> | null = null;

  private endpoint: string = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SURREAL_URL) || 
    (typeof globalThis !== 'undefined' && (globalThis as any).process?.env?.VITE_SURREAL_URL) || 
    'http://127.0.0.1:8000';
  private namespace: string = 'nft_platformer';
  private database: string = 'development';
  private connectedWallet: string = (typeof localStorage !== 'undefined' && localStorage.getItem('onion_boy_wallet')) || '0x0000000000000000000000000000000000000000';

  constructor() {
    this.db = new Surreal();
    this.tryConnect().catch(() => {});
  }

  public getConnectedWallet(): string {
    return this.connectedWallet;
  }

  public setConnectedWallet(wallet: string): void {
    if (wallet && wallet.startsWith('0x') && wallet.length === 42) {
      this.connectedWallet = wallet;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('onion_boy_wallet', wallet);
      }
    }
  }

  public static getInstance(): SurrealService {
    if (!SurrealService.instance) {
      SurrealService.instance = new SurrealService();
    }
    return SurrealService.instance;
  }

  public async tryConnect(): Promise<boolean> {
    if (this.isConnected) return true;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = (async () => {
      try {
        await this.db.connect(this.endpoint);
        await this.db.use({
          namespace: this.namespace,
          database: this.database
        });
        this.isConnected = true;
        console.log(`[SurrealDB] Connected successfully to ${this.endpoint} [NS: ${this.namespace}, DB: ${this.database}]`);
        
        // Auto-authenticate session via Record Access (player_auth)
        await this.ensureAuthenticated();
        return true;
      } catch (err) {
        this.isConnected = false;
        console.warn('[SurrealDB] Server connection pending or offline. Operating in fallback mode:', (err as Error).message);
        return false;
      } finally {
        this.connectPromise = null;
      }
    })();

    return this.connectPromise;
  }

  public isOnline(): boolean {
    return this.isConnected;
  }

  /**
   * Auto-authenticate player session via Record Access (Guest or Connected Wallet)
   */
  public async ensureAuthenticated(explicitWallet?: string): Promise<boolean> {
    let wallet = explicitWallet || this.connectedWallet;

    if (!wallet || wallet === '0x0000000000000000000000000000000000000000') {
      let guestWallet = typeof localStorage !== 'undefined' ? localStorage.getItem('onion_boy_guest_wallet') : null;
      if (!guestWallet || !guestWallet.startsWith('0x') || guestWallet.length !== 42) {
        const hex = Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
        guestWallet = `0x${hex}`;
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('onion_boy_guest_wallet', guestWallet);
        }
      }
      wallet = guestWallet;
      this.connectedWallet = guestWallet;
    }

    try {
      // 1. Try Signing In as existing player record
      await this.db.signin({
        namespace: this.namespace,
        database: this.database,
        access: 'player_auth',
        variables: { wallet }
      });
      this.isAuthenticated = true;
      console.log(`[SurrealDB] Authenticated player record: ${wallet}`);
      return true;
    } catch (_signinErr) {
      try {
        // 2. If record does not exist yet, Sign Up as new player record
        await this.db.signup({
          namespace: this.namespace,
          database: this.database,
          access: 'player_auth',
          variables: { wallet }
        });
        this.isAuthenticated = true;
        console.log(`[SurrealDB] Registered & authenticated player record: ${wallet}`);
        return true;
      } catch (signupErr) {
        console.warn('[SurrealDB] Record authentication warning:', (signupErr as Error).message);
        return false;
      }
    }
  }

  /**
   * Authenticate player via Web3 wallet Record Access
   */
  public async signinWithWallet(walletAddress: string): Promise<boolean> {
    if (!this.isConnected) {
      await this.tryConnect();
    }
    const success = await this.ensureAuthenticated(walletAddress);
    if (success) {
      this.setConnectedWallet(walletAddress);
    }
    return success;
  }

  public isUserAuthenticated(): boolean {
    return this.isAuthenticated;
  }

  /**
   * Start a new run session directly on SurrealDB backend
   */
  public async startRun(wallet?: string, stage: string = 'stage1'): Promise<SurrealRunSession> {
    const finalWallet = (wallet && wallet !== '0x0000000000000000000000000000000000000000') ? wallet : this.connectedWallet;

    if (!this.isConnected) {
      await this.tryConnect();
    }

    if (this.isConnected) {
      try {
        const res = await this.db.query<[Record<string, any>]>(
          'RETURN fn::start_run($wallet, $stage);',
          { wallet: finalWallet, stage }
        );
        const data = res && res[0];
        if (data) {
          const runId = data.run_id || data.runId;
          const startTime = data.start_time || data.startTime || Date.now();
          if (runId) {
            SecurityManager.getInstance().setBackendRunId(runId, startTime);
            return {
              runId,
              startTime,
              stage: data.stage || stage
            };
          }
        }
      } catch (err) {
        console.warn('[SurrealDB] fn::start_run failed, using client fallback:', err);
      }
    }

    // Client fallback session
    const fallbackRunId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    SecurityManager.getInstance().setBackendRunId(fallbackRunId);
    return {
      runId: fallbackRunId,
      startTime: Date.now(),
      stage
    };
  }

  /**
   * Submit and verify run through SurrealDB fn::submit_run
   */
  public async submitRun(
    payload: VerifiedRunPayload,
    inputs: Array<{ frame: number; keys: string[] }>,
    playerName: string = 'Anonymous Player',
    walletAddress?: string
  ): Promise<SurrealSubmitResult> {
    const wallet = (walletAddress && walletAddress !== '0x0000000000000000000000000000000000000000') ? walletAddress : this.connectedWallet;
    const score = (payload.totalCoins * 50) + (payload.totalKills * 100) - (payload.totalDeaths * 200) + Math.max(0, 5000 - Math.floor(payload.totalDurationMs / 100));
    const totalSecs = Math.floor(payload.totalDurationMs / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const hundredths = Math.floor((payload.totalDurationMs % 1000) / 10);
    const formattedTime = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;

    if (!this.isConnected) {
      await this.tryConnect();
    }

    if (this.isConnected) {
      try {
        const res = await this.db.query<[SurrealSubmitResult]>(
          `RETURN fn::submit_run(
            $run_id, 
            $wallet, 
            $username, 
            $duration_ms, 
            $formatted_time, 
            $score, 
            $coins, 
            $kills, 
            $deaths, 
            $inputs, 
            $final_hash
          );`,
          {
            run_id: payload.runId,
            wallet: wallet,
            username: playerName,
            duration_ms: payload.totalDurationMs,
            formatted_time: formattedTime,
            score: Math.max(0, score),
            coins: payload.totalCoins,
            kills: payload.totalKills,
            deaths: payload.totalDeaths,
            inputs: inputs,
            final_hash: payload.finalHash
          }
        );

        if (res && res[0]) {
          return res[0];
        }
      } catch (err) {
        console.warn('[SurrealDB] fn::submit_run failed, falling back to local verification:', err);
      }
    }

    // Local fallback evaluation
    return {
      success: payload.isLegitimate,
      verified: payload.isLegitimate,
      rank: 1,
      isWhitelisted: payload.isLegitimate,
      message: payload.isLegitimate ? 'Run verified locally (Offline Mode)' : `Verification failed: ${payload.validationFlags.join(', ')}`
    };
  }

  /**
   * Fetch live global leaderboard from SurrealDB
   */
  public async getLeaderboard(limit: number = 10): Promise<LeaderboardEntry[]> {
    if (!this.isConnected) {
      await this.tryConnect();
    }

    if (this.isConnected) {
      try {
        const res = await this.db.query<[any[]]>(
          'RETURN fn::get_leaderboard($limit);',
          { limit }
        );

        if (res && Array.isArray(res[0])) {
          return res[0].map((entry: any, index: number) => ({
            rank: index + 1,
            playerName: entry.username || 'Anonymous',
            walletAddress: entry.wallet,
            timeMs: entry.duration_ms,
            formattedTime: entry.formatted_time,
            score: entry.score,
            coins: entry.coins,
            kills: entry.kills,
            deaths: entry.deaths,
            verified: entry.verified,
            timestamp: new Date(entry.created_at).getTime(),
            runId: entry.run_id
          }));
        }
      } catch (err) {
        console.warn('[SurrealDB] fn::get_leaderboard query failed, using local cache:', err);
      }
    }

    return [];
  }
}
