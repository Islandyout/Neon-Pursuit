import type { QualityProfile, QualityTier } from './contracts';

export const QUALITY_PROFILES: Record<QualityTier, QualityProfile> = {
  desktop: { tier: 'desktop', targetDpr: 1.8, cityRadius: 1, buildingSlots: 3, bloom: true, trafficBudget: 22, policeBudget: 5 },
  'mobile-high': { tier: 'mobile-high', targetDpr: 1.35, cityRadius: 0.85, buildingSlots: 3, bloom: true, trafficBudget: 14, policeBudget: 3 },
  'mobile-low': { tier: 'mobile-low', targetDpr: 1, cityRadius: 0.68, buildingSlots: 2, bloom: false, trafficBudget: 8, policeBudget: 2 }
};

export class PerformanceManager {
  private frameSamples: number[] = [];
  private renderScale = 1;
  private fps = 60;

  constructor(readonly tier: QualityTier) {}

  recordFrame(dt: number): boolean {
    if (dt <= 0 || !Number.isFinite(dt)) return false;
    this.frameSamples.push(dt);
    if (this.frameSamples.length < 90) return false;

    const average = this.frameSamples.reduce((sum, sample) => sum + sample, 0) / this.frameSamples.length;
    this.frameSamples = [];
    this.fps = Math.round(1 / average);
    const floor = this.tier === 'mobile-low' ? 0.72 : 0.78;
    const previous = this.renderScale;
    if (this.fps < 38) this.renderScale = Math.max(floor, this.renderScale - 0.08);
    else if (this.fps > 56) this.renderScale = Math.min(1, this.renderScale + 0.04);
    return Math.abs(previous - this.renderScale) > 0.001;
  }

  getTargetDpr(devicePixelRatio: number): number {
    const base = QUALITY_PROFILES[this.tier].targetDpr;
    return Math.min(devicePixelRatio, base * this.renderScale);
  }

  getFps(): number {
    return this.fps;
  }

  getRenderScale(): number {
    return this.renderScale;
  }
}
