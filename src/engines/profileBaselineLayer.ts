/**
 * Profile Baseline Correction Layer (Variant A)
 *
 * Soft correction for chronically low/high profiles only.
 * Applies a uniform +adj to all 6 domain categories; overall is recalculated.
 * Category ranking, daily variability, and category spread are fully preserved
 * because the shift is identical across all categories.
 *
 * Activation rules:
 *   rollingAvg < 58  →  adj = min(+5.0, (60 − avg) × 0.35)
 *   rollingAvg > 74  →  adj = max(−3.0, (60 − avg) × 0.15)
 *   58 ≤ avg ≤ 74   →  adj = 0  (no change for normal profiles)
 *
 * The rolling window tracks PRE-correction daily overalls so that the
 * window always reflects the true engine output level of the profile.
 */
import type { ScoreMap } from "./sajuEngine";

// ── Parameters ─────────────────────────────────────────────────────────────────

export const BASELINE_WINDOW   = 30;   // rolling window length in days
export const BASELINE_MIN_DAYS = 7;    // minimum days before correction activates

const DOM_CATS = ["wealth", "love", "health", "career", "relations", "study"] as const;

// ── Config Interface ────────────────────────────────────────────────────────────

export interface BaselineConfig {
  floorThr:   number;   // avg below this triggers upward correction
  ceilThr:    number;   // avg above this triggers downward correction
  target:     number;   // correction target
  strengthLo: number;   // multiplier for low correction
  strengthHi: number;   // multiplier for high correction
  maxAdjLo:   number;   // max upward correction (positive)
  maxAdjHi:   number;   // max downward correction (negative)
  minDays:    number;   // min window size before correction activates
}

export const DEFAULT_BASELINE_CONFIG: BaselineConfig = {
  floorThr:   58,
  ceilThr:    74,
  target:     60,
  strengthLo: 0.35,
  strengthHi: 0.15,
  maxAdjLo:   5.0,
  maxAdjHi:   -3.0,
  minDays:    7,
};

/** 낮은 프로필 수렴 강화 — FLOOR_THR 상향, STRENGTH_LO 강화, MIN_DAYS 단축 */
export const STRONG_BASELINE_CONFIG: BaselineConfig = {
  floorThr:   62,
  ceilThr:    74,
  target:     60,
  strengthLo: 0.50,
  strengthHi: 0.15,
  maxAdjLo:   6.0,
  maxAdjHi:   -3.0,
  minDays:    4,
};

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Compute the correction amount from the current rolling window.
 * Returns 0 when the window is too small or the average is in the normal range.
 */
export function computeBaselineAdj(window: readonly number[], cfg: BaselineConfig = DEFAULT_BASELINE_CONFIG): number {
  if (window.length < cfg.minDays) return 0;
  const avg = window.reduce((s, v) => s + v, 0) / window.length;
  if (avg < cfg.floorThr) return Math.min(cfg.maxAdjLo,  (cfg.target - avg) * cfg.strengthLo);
  if (avg > cfg.ceilThr)  return Math.max(cfg.maxAdjHi, (cfg.target - avg) * cfg.strengthHi);
  return 0;
}

/**
 * Apply adj uniformly to all 6 domain categories and recalculate overall.
 * No-ops when adj is negligible (< 0.05).
 * Mutates merged in place — call before final Math.round pass.
 */
export function applyBaselineCorrection(merged: ScoreMap, adj: number): void {
  if (Math.abs(adj) < 0.05) return;
  for (const cat of DOM_CATS) {
    merged[cat] = Math.max(0, Math.min(100, (merged[cat] as number) + adj));
  }
  merged.overall = Math.max(0, Math.min(100,
    DOM_CATS.reduce((s, c) => s + (merged[c] as number), 0) / DOM_CATS.length
  ));
}

/**
 * Push a pre-correction overall score into the rolling window.
 * Drops the oldest entry when the window reaches capacity.
 */
export function pushBaselineOverall(window: number[], overall: number): void {
  window.push(overall);
  if (window.length > BASELINE_WINDOW) window.shift();
}
