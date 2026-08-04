/** Dev-only navigation timing helpers for Instant Load acceptance checks. */

let lastNavHref: string | null = null;
let lastNavAt = 0;

export function markNavClick(href: string) {
  if (process.env.NODE_ENV !== 'development') return;
  lastNavHref = href;
  lastNavAt = performance.now();
  performance.mark(`nav-click:${href}`);
}

export function markNavPaint(href?: string) {
  if (process.env.NODE_ENV !== 'development') return;
  const target = href ?? lastNavHref;
  if (!target || !lastNavAt) return;
  const ms = Math.round(performance.now() - lastNavAt);
  // eslint-disable-next-line no-console
  console.info(`[perf] nav → ${target} first paint/settle ≈ ${ms}ms`);
  lastNavAt = 0;
}
