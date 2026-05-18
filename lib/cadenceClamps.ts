import {
  MAX_ANIMATED_PER_MONTH,
  MAX_CALENDAR_ROWS_PER_MONTH,
  MAX_CAROUSELS_PER_MONTH,
  MAX_POSTS_PER_MONTH,
} from "@/lib/constants/cadence";

export function clampPostsPerMonth(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(MAX_POSTS_PER_MONTH, Math.floor(n));
}

export function maxCarouselsForCadence(postsPerMonth: number, animatedPerMonth: number): number {
  const posts = clampPostsPerMonth(postsPerMonth);
  const animated = Number.isFinite(animatedPerMonth) ? Math.max(0, Math.floor(animatedPerMonth)) : 0;
  return Math.min(
    MAX_CAROUSELS_PER_MONTH,
    Math.max(0, MAX_CALENDAR_ROWS_PER_MONTH - posts - animated)
  );
}

export function maxAnimatedForCadence(postsPerMonth: number, carouselsPerMonth: number): number {
  const posts = clampPostsPerMonth(postsPerMonth);
  const carousels = Number.isFinite(carouselsPerMonth) ? Math.max(0, Math.floor(carouselsPerMonth)) : 0;
  return Math.min(
    MAX_ANIMATED_PER_MONTH,
    Math.max(0, MAX_CALENDAR_ROWS_PER_MONTH - posts - carousels)
  );
}

export function clampCarouselsPerMonth(
  carousels: number,
  postsPerMonth: number,
  animatedPerMonth: number
): number {
  if (!Number.isFinite(carousels) || carousels < 0) return 0;
  return Math.min(maxCarouselsForCadence(postsPerMonth, animatedPerMonth), Math.floor(carousels));
}

export function clampAnimatedPerMonth(
  animated: number,
  postsPerMonth: number,
  carouselsPerMonth: number
): number {
  if (!Number.isFinite(animated) || animated < 0) return 0;
  return Math.min(maxAnimatedForCadence(postsPerMonth, carouselsPerMonth), Math.floor(animated));
}

export function normalizeClientCadence(
  postsPerMonth: number,
  carouselsPerMonth: number,
  animatedPerMonth: number
): { postsPerMonth: number; carouselsPerMonth: number; animatedPerMonth: number } {
  const posts = clampPostsPerMonth(postsPerMonth);
  let carousels = clampCarouselsPerMonth(carouselsPerMonth, posts, animatedPerMonth);
  let animated = clampAnimatedPerMonth(animatedPerMonth, posts, carousels);
  carousels = clampCarouselsPerMonth(carousels, posts, animated);
  animated = clampAnimatedPerMonth(animated, posts, carousels);
  return { postsPerMonth: posts, carouselsPerMonth: carousels, animatedPerMonth: animated };
}
