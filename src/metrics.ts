/**
 * Client metrics for tracking performance and usage
 * Ported from chatdelta-rs/src/metrics.rs
 */
export class ClientMetrics {
  private requestsTotal: number = 0;
  private requestsSucceeded: number = 0;
  private requestsFailed: number = 0;
  private totalLatencyMs: number = 0;
  private latencies: number[] = [];
  private promptTokensTotal: number = 0;
  private completionTokensTotal: number = 0;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  private startTime: number = Date.now();

  /**
   * Record a successful request
   */
  recordSuccess(latencyMs?: number, promptTokens?: number, completionTokens?: number): void {
    this.requestsTotal++;
    this.requestsSucceeded++;
    
    if (latencyMs !== undefined) {
      this.totalLatencyMs += latencyMs;
      this.latencies.push(latencyMs);
    }
    
    if (promptTokens !== undefined) {
      this.promptTokensTotal += promptTokens;
    }
    
    if (completionTokens !== undefined) {
      this.completionTokensTotal += completionTokens;
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(): void {
    this.requestsTotal++;
    this.requestsFailed++;
  }

  /**
   * Record a cache hit
   */
  recordCacheHit(): void {
    this.cacheHits++;
  }

  /**
   * Record a cache miss
   */
  recordCacheMiss(): void {
    this.cacheMisses++;
  }

  /**
   * Get a snapshot of current metrics
   */
  getSnapshot(): MetricsSnapshot {
    const now = Date.now();
    const durationMs = now - this.startTime;
    
    return {
      requestsTotal: this.requestsTotal,
      requestsSucceeded: this.requestsSucceeded,
      requestsFailed: this.requestsFailed,
      successRate: this.requestsTotal > 0 
        ? (this.requestsSucceeded / this.requestsTotal) * 100 
        : 0,
      averageLatencyMs: this.latencies.length > 0
        ? this.totalLatencyMs / this.latencies.length
        : 0,
      p50LatencyMs: this.calculatePercentile(50),
      p95LatencyMs: this.calculatePercentile(95),
      p99LatencyMs: this.calculatePercentile(99),
      promptTokensTotal: this.promptTokensTotal,
      completionTokensTotal: this.completionTokensTotal,
      totalTokens: this.promptTokensTotal + this.completionTokensTotal,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRate: (this.cacheHits + this.cacheMisses) > 0
        ? (this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100
        : 0,
      durationMs,
      requestsPerSecond: durationMs > 0 
        ? (this.requestsTotal / durationMs) * 1000
        : 0,
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.requestsTotal = 0;
    this.requestsSucceeded = 0;
    this.requestsFailed = 0;
    this.totalLatencyMs = 0;
    this.latencies = [];
    this.promptTokensTotal = 0;
    this.completionTokensTotal = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.startTime = Date.now();
  }

  /**
   * Calculate percentile from latencies
   */
  private calculatePercentile(percentile: number): number {
    if (this.latencies.length === 0) {
      return 0;
    }
    
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
}

/**
 * Snapshot of metrics at a point in time
 */
export interface MetricsSnapshot {
  requestsTotal: number;
  requestsSucceeded: number;
  requestsFailed: number;
  successRate: number;
  averageLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  promptTokensTotal: number;
  completionTokensTotal: number;
  totalTokens: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  durationMs: number;
  requestsPerSecond: number;
}

/**
 * Request timer for measuring individual request latency
 */
export class RequestTimer {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Get elapsed time in milliseconds
   */
  elapsed(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Reset the timer
   */
  reset(): void {
    this.startTime = Date.now();
  }
}