import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { isNativeApp } from "../native/runtime";
import { telegram } from "../telegram";

type InstallChoice = { outcome: "accepted" | "dismissed" };
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};

function isInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function isMobileDevice() {
  return (
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isIosDevice() {
  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function InstallPrompt({
  preview,
}: {
  preview?: "ios";
} = {}) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"native" | "ios">();
  const [installEvent, setInstallEvent] = useState<InstallEvent>();
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    if (preview) {
      setMode(preview);
      return;
    }
    if (
      isNativeApp() ||
      telegram.isTelegram ||
      isInstalled() ||
      !isMobileDevice()
    )
      return;

    if (isIosDevice()) setMode("ios");
    const offer = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
      setMode("native");
    };
    const installed = () => {
      setMode(undefined);
      setInstallEvent(undefined);
    };
    window.addEventListener("beforeinstallprompt", offer);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", offer);
      window.removeEventListener("appinstalled", installed);
    };
  }, [preview]);

  if (!mode) return null;
  const dismiss = () => setMode(undefined);
  const install = async () => {
    if (mode === "ios") {
      setShowInstructions((value) => !value);
      return;
    }
    if (!installEvent) return;
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      setInstallEvent(undefined);
      if (choice.outcome === "accepted") setMode(undefined);
      else dismiss();
    } catch {
      // The browser owns this native dialog and may withdraw the offer.
      setInstallEvent(undefined);
      setMode(undefined);
    }
  };

  return (
    <aside className="install-prompt" aria-label={t("installTitle")}>
      <img
        src={`${import.meta.env.BASE_URL}icons/icon-192.png`}
        alt=""
        width="56"
        height="56"
      />
      <div className="install-prompt-copy">
        <strong>{t("installTitle")}</strong>
        <p>{t("installCopy")}</p>
        {showInstructions && (
          <p className="install-instructions" role="status">
            {t("installIosSteps")}
          </p>
        )}
        <button className="install-prompt-action" onClick={() => void install()}>
          {t(mode === "ios" ? "installIosAction" : "installAction")}
        </button>
      </div>
      <button
        className="install-prompt-close"
        onClick={dismiss}
        aria-label={t("dismissInstall")}
      >
        ×
      </button>
    </aside>
  );
}
