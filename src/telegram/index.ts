declare global { interface Window { Telegram?: { WebApp?: { ready?: () => void; expand?: () => void; HapticFeedback?: { impactOccurred?: (style: string) => void; notificationOccurred?: (type: string) => void }; sendData?: (data: string) => void; } } } }

export const telegram = {
  get isTelegram() { return Boolean(window.Telegram?.WebApp); },
  init() { window.Telegram?.WebApp?.ready?.(); window.Telegram?.WebApp?.expand?.(); },
  impact(style: 'light' | 'medium' | 'heavy' = 'light') { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.(style); },
  success() { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.('success'); },
  sendSound(meta: object) {
    if (!window.Telegram?.WebApp?.sendData) return false;
    window.Telegram.WebApp.sendData(JSON.stringify({ type: 'field-sound', ...meta }));
    return true;
  }
};
