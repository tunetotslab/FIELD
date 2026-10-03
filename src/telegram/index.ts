import { initTheme } from "../theme";
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
  isVersionAtLeast?: (version: string) => boolean;
  downloadFile?: (
    params: { url: string; file_name: string },
    callback?: (accepted: boolean) => void,
  ) => void;
  colorScheme?: "light" | "dark";
  openInvoice?: (url: string, callback: (status: string) => void) => void;
  openLink?: (url: string) => void;
  openTelegramLink?: (url: string) => void;
  shareMessage?: (id: string, callback?: (sent: boolean) => void) => void;
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
  get isTelegram() {
    return Boolean(window.Telegram?.WebApp?.initData);
  },
  init() {
    const webApp = window.Telegram?.WebApp;
    const cleanup = initTheme();
    const resize = () => {
      const viewport = window.visualViewport;
      if (!viewport || viewport.scale === 1)
        document.documentElement.style.setProperty(
          "--field-viewport-height",
          `${viewport?.height || window.innerHeight}px`,
        );
    };
    resize();
    window.visualViewport?.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("scroll", resize);
    window.addEventListener("resize", resize);
    webApp?.onEvent?.("viewportChanged", resize);
    const dispose = () => {
      cleanup();
      window.visualViewport?.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("scroll", resize);
      window.removeEventListener("resize", resize);
      webApp?.offEvent?.("viewportChanged", resize);
    };
    if (!webApp) return dispose;
    webApp.ready?.();
    webApp.expand?.();
    return dispose;
  },
  impact(style: "light" | "medium" | "heavy" = "light") {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.(style);
  },
  success() {
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
  },
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
  openBrowser(url: string) {
    if (telegram.isTelegram && window.Telegram?.WebApp?.openLink) window.Telegram.WebApp.openLink(url);
    else window.open(url, "_blank", "noopener,noreferrer");
  },
  openChat(url: string) {
    if (telegram.isTelegram && window.Telegram?.WebApp?.openTelegramLink)
      window.Telegram.WebApp.openTelegramLink(url);
    else window.open(url, "_blank", "noopener,noreferrer");
  },
  shareFile(id: string) {
    const app = window.Telegram?.WebApp;
    if (app?.shareMessage && app.isVersionAtLeast?.("8.0")) {
      try {
        app.shareMessage(id);
      } catch {
        /* The WAV is already in the private bot chat. */
      }
    }
  },
};
