import { initTheme } from '../theme';
type ThemeParams = Partial<{
  bg_color: string;
  secondary_bg_color: string;
  text_color: string;
  hint_color: string;
  link_color: string;
  button_color: string;
  button_text_color: string;
  bottom_bar_bg_color: string;
}>;

type TelegramWebApp = {
  initData?: string;
  platform?: string;
  colorScheme?: 'light' | 'dark';
  openInvoice?: (url: string, callback: (status: string) => void) => void;
  ready?: () => void;
  expand?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  themeParams?: ThemeParams;
  HapticFeedback?: {
    impactOccurred?: (style: string) => void;
    notificationOccurred?: (type: string) => void;
  };
  BackButton?: {
    show?: () => void;
    hide?: () => void;
    onClick?: (callback: () => void) => void;
    offClick?: (callback: () => void) => void;
  };
  onEvent?: (event: string, callback: () => void) => void;
  offEvent?: (event: string, callback: () => void) => void;
  sendData?: (data: string) => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

let activeBackHandler: (() => void) | undefined;

export const telegram = {
  get isTelegram() { return Boolean(window.Telegram?.WebApp?.initData); },
  init() {
    const webApp = window.Telegram?.WebApp;
    const cleanup = initTheme();
    if (!webApp) return cleanup;
    webApp.ready?.();
    webApp.expand?.();
    return cleanup;
  },
  impact(style: 'light' | 'medium' | 'heavy' = 'light') { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.(style); },
  success() { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.('success'); },
  setBackButton(visible: boolean, onBack: () => void) {
    const backButton = window.Telegram?.WebApp?.BackButton;
    if (!backButton) return;
    if (activeBackHandler) backButton.offClick?.(activeBackHandler);
    activeBackHandler = undefined;
    if (visible) {
      backButton.onClick?.(onBack);
      activeBackHandler = onBack;
      backButton.show?.();
    } else {
      backButton.hide?.();
    }
  },
  sendSound(meta: object) {
    if (!window.Telegram?.WebApp?.sendData) return false;
    window.Telegram.WebApp.sendData(JSON.stringify({ type: 'field-sound', ...meta }));
    return true;
  }
};
