import { ClockTuple } from '../types/sync';

export interface ClockSnapshot {
  deviceId: string;
  localCounter: number;
  observedCounter: number;
}

// ---------------------------------------------------------------------------
// Ordering & Causal Dominance Functions
// ---------------------------------------------------------------------------

/**
 * Compares two logical clock tuples deterministically.
 * Primary sort: Lamport scalar value.
 * Tie-breaker: Deterministic lexicographical string comparison of Device IDs.
 */
export function compareClockTuple(a: ClockTuple, b: ClockTuple): number {
  if (a.lamport !== b.lamport) {
    return a.lamport - b.lamport;
  }
  return a.deviceId.localeCompare(b.deviceId);
}

/**
 * Returns true if clock A is strictly newer than/dominates clock B causally.
 */
export function strictlyDominates(a: ClockTuple, b: ClockTuple): boolean {
  return compareClockTuple(a, b) > 0;
}

// ---------------------------------------------------------------------------
// Clock Singleton
// ---------------------------------------------------------------------------
export class CoherenceClock {
  private static instance: CoherenceClock;
  private deviceId!: string;
  private localCounter: number = 0;
  private maxObservedCounter: number = 0;

  private constructor() {}

  /**
   * Initializes the singleton instance. Accepts individual counters or a full snapshot.
   */
  public static async initialize(
    deviceId: string,
    localCounter: number = 0,
    maxObservedCounter: number = 0
  ): Promise<CoherenceClock> {
    if (!CoherenceClock.instance) {
      CoherenceClock.instance = new CoherenceClock();
      CoherenceClock.instance.deviceId = deviceId;
      CoherenceClock.instance.localCounter = localCounter;
      CoherenceClock.instance.maxObservedCounter = Math.max(localCounter, maxObservedCounter);
    }
    return CoherenceClock.instance;
  }

  public static getInstance(): CoherenceClock {
    if (!CoherenceClock.instance) {
      throw new Error('[CoherenceClock] Not initialized. Call initialize() first.');
    }
    return CoherenceClock.instance;
  }

  /**
   * Local Intent.
   * Increments the causal state past both our current local ceiling and 
   * anything we have observed from the network, providing the new unique point in time.
   */
  public tick(): ClockTuple {
    const nextCounter = Math.max(this.localCounter, this.maxObservedCounter) + 1;
    this.localCounter = nextCounter;
    this.maxObservedCounter = nextCounter;
    
    return { lamport: this.localCounter, deviceId: this.deviceId };
  }

  /**
   * Remote Evidence.
   * Absorbs incoming timeline progress from a peer. This moves our horizon forward
   * but does NOT modify our local counter until the next local intent occurs via tick().
   */
  public observe(remote: ClockTuple): void {
    this.maxObservedCounter = Math.max(this.maxObservedCounter, remote.lamport);
  }

  public currentLocal(): ClockTuple {
    return { lamport: this.localCounter, deviceId: this.deviceId };
  }

  public getDeviceId(): string {
    return this.deviceId;
  }

  public getCounter(): number {
    return this.localCounter;
  }

  public snapshot(): ClockSnapshot {
    return {
      deviceId: this.deviceId,
      localCounter: this.localCounter,
      observedCounter: this.maxObservedCounter
    };
  }
}