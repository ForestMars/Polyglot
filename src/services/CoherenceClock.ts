// src/services/CoherenceClock.ts
// Singleton Lamport clock. Platform-agnostic: no DOM, no storage, no fetch.
// Persistence is handled externally (db.ts writes counter to metadata store).

import { ClockTuple } from '../types/sync';

export class CoherenceClock {
  private static instance: CoherenceClock;
  private deviceId!: string;
  private localCounter: number = 0;
  private maxObservedCounter: number = 0;

  private constructor() {}

  public static async initialize(
    deviceId: string,
    initialCounter: number = 0
  ): Promise<CoherenceClock> {
    if (!CoherenceClock.instance) {
      CoherenceClock.instance = new CoherenceClock();
      CoherenceClock.instance.deviceId = deviceId;
      CoherenceClock.instance.localCounter = initialCounter;
      CoherenceClock.instance.maxObservedCounter = initialCounter;
    }
    return CoherenceClock.instance;
  }

  public static getInstance(): CoherenceClock {
    if (!CoherenceClock.instance) {
      throw new Error('[CoherenceClock] Not initialized. Call initialize() first.');
    }
    return CoherenceClock.instance;
  }

  // Advance clock and return new tuple.
  public tick(): ClockTuple {
    this.localCounter = Math.max(this.localCounter, this.maxObservedCounter) + 1;
    this.maxObservedCounter = this.localCounter;
    return { lamport: this.localCounter, deviceId: this.deviceId };
  }

  // Update max observed from an incoming remote tuple.
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
}