/** Telegram WebViews may stay mounted while backgrounded. */
export function subscribeForeground(refresh: () => void, intervalMs?: number) {
  const visible = () => {
    if (document.visibilityState === 'visible') refresh();
  };
  document.addEventListener('visibilitychange', visible);
  window.addEventListener('focus', visible);
  window.addEventListener('online', visible);
  const timer = intervalMs ? window.setInterval(visible, intervalMs) : undefined;
  return () => {
    document.removeEventListener('visibilitychange', visible);
    window.removeEventListener('focus', visible);
    window.removeEventListener('online', visible);
    if (timer !== undefined) window.clearInterval(timer);
  };
}
