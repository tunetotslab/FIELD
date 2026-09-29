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

const themeVariables: Record<string, string> = {
  bg_color: "--tg-bg-color",
  secondary_bg_color: "--tg-secondary-bg-color",
  text_color: "--tg-text-color",
  hint_color: "--tg-hint-color",
  link_color: "--tg-link-color",
  button_color: "--tg-button-color",
  button_text_color: "--tg-button-text-color",
  bottom_bar_bg_color: "--tg-bottom-bar-bg-color",
};

function applyTheme(theme: ThemeParams = {}) {
  const root = document.documentElement;
  for (const [telegramName, cssName] of Object.entries(themeVariables)) {
    const value = theme[telegramName as keyof ThemeParams];
    if (value) root.style.setProperty(cssName, value);
  }
  root.dataset.telegram = "true";
}

let activeBackHandler: (() => void) | undefined;

export const telegram = {
  get isTelegram() { return Boolean(window.Telegram?.WebApp); },
  init() {
    const webApp = window.Telegram?.WebApp;
    if (!webApp) return;
    applyTheme(webApp.themeParams);
    webApp.ready?.();
    webApp.expand?.();
    webApp.setHeaderColor?.(webApp.themeParams?.bg_color || "#fffaf7");
    webApp.setBackgroundColor?.(webApp.themeParams?.bg_color || "#fffaf7");
    webApp.onEvent?.("themeChanged", () => {
      applyTheme(webApp.themeParams);
      webApp.setHeaderColor?.(webApp.themeParams?.bg_color || "#fffaf7");
      webApp.setBackgroundColor?.(webApp.themeParams?.bg_color || "#fffaf7");
    });
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
