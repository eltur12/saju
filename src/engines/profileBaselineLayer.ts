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

const FLOOR_THR   = 58;
const CEIL_THR    = 74;
const TARGET      = 60;
const STRENGTH_LO = 0.35;
const STRENGTH_HI = 0.15;
const MAX_ADJ_LO  =  5.0;   // max upward correction
const MAX_ADJ_HI  = -3.0;   // max downward correction

const DOM_CATS = ["wealth", "love", "health", "career", "relations", "study"] as const;

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Compute the correction amount from the current rolling window.
 * Returns 0 when the window is too small or the average is in the normal range.
 */
export function computeBaselineAdj(window: readonly number[]): number {
  if (window.length < BASELINE_MIN_DAYS) return 0;
  const avg = window.reduce((s, v) => s + v, 0) / window.length;
  if (avg < FLOOR_THR) return Math.min(MAX_ADJ_LO, (TARGET - avg) * STRENGTH_LO);
  if (avg > CEIL_THR)  return Math.max(MAX_ADJ_HI, (TARGET - avg) * STRENGTH_HI);
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
