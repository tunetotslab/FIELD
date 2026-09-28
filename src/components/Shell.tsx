import { createContext, useContext, type ReactNode } from "react";
import { TuneTotsLogo } from "./Brand";
import { useI18n } from "../i18n";
import type { Screen } from "../types";
import { EXTERNAL_LINKS } from "../config";

const NavigationContext = createContext<{
  screen: Screen;
  go: (screen: Screen) => void;
} | null>(null);

export function AppNavigationProvider({
  children,
  screen,
  go,
}: {
  children: ReactNode;
  screen: Screen;
  go: (screen: Screen) => void;
}) {
  return (
    <NavigationContext.Provider value={{ screen, go }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function Shell({
  children,
  title,
  back,
  right,
  nav,
  variant,
}: {
  children: ReactNode;
  title?: string;
  back?: () => void;
  right?: ReactNode;
  nav?: ReactNode;
  variant?: "home" | "world" | "fx";
}) {
  const { t } = useI18n();
  const navigation = useContext(NavigationContext);
  const showBottomNavigation = navigation && navigation.screen !== "record";
  const showSettings =
    navigation &&
    ![
      "record",
      "settings",
      "links",
      "privacy",
      "microphone",
      "about",
      "help",
    ].includes(navigation.screen);
  return (
    <main className={`app-shell${variant ? ` shell-${variant}` : ""}`}>
      <header className="app-header">
        <div className="header-side">
          {back && (
            <button
              className="icon-button"
              onClick={back}
              aria-label={t("back")}
            >
              ←
            </button>
          )}
        </div>
        <TuneTotsLogo />
        <div className="header-side header-right">
          {right}
          {showSettings && (
            <button
              className="icon-button settings-button"
              onClick={() => navigation.go("settings")}
              aria-label={t("settings")}
            >
              ⚙
            </button>
          )}
        </div>
      </header>
      {title && <h1 className="screen-title">{title}</h1>}
      <section className="screen-content">{children}</section>
      {nav ??
        (showBottomNavigation ? (
          <BottomNav go={navigation.go} active={navigation.screen} />
        ) : null)}
    </main>
  );
}

export function BrandFooter() {
  const { t } = useI18n();
  return (
    <a
      className="brand-footer brand-footer-link"
      href={EXTERNAL_LINKS.TUNE_TOTS_INSTAGRAM}
      target="_blank"
      rel="noopener noreferrer"
    >
      {t("madeBy")}
    </a>
  );
}

export function BottomNav({
  go,
  active,
}: {
  go: (screen: "home" | "library" | "daily" | "map") => void;
  active?: string;
}) {
  const { t } = useI18n();
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      <button
        className={active === "home" ? "active" : ""}
        onClick={() => go("home")}
      >
        <NavIcon type="record" />
        {t("navRecord")}
      </button>
      <button
        className={active === "library" ? "active" : ""}
        onClick={() => go("library")}
      >
        <NavIcon type="library" />
        {t("library")}
      </button>
      <button
        className={active === "daily" ? "active" : ""}
        onClick={() => go("daily")}
      >
        <NavIcon type="daily" />
        {t("daily")}
      </button>
      <button
        className={active === "map" ? "active" : ""}
        onClick={() => go("map")}
      >
        <NavIcon type="globe" />
        {t("map")}
      </button>
    </nav>
  );
}

function NavIcon({
  type,
}: {
  type: "record" | "library" | "daily" | "globe";
}) {
  if (type === "record")
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <circle className="nav-record-dot" cx="12" cy="12" r="4.25" />
      </svg>
    );
  if (type === "library")
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5.5v13M9 4.5v14M14 6v12.5M19 4v14.5M3 19h18" />
      </svg>
    );
  if (type === "daily")
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 3 2.2 5.2L20 9l-4.3 3.8 1.2 5.7L12 15.6l-4.9 2.9 1.2-5.7L4 9l5.8-.8L12 3Z" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.8 12h16.4M12 3.5c2.2 2.3 3.2 5.1 3.2 8.5S14.2 18.2 12 20.5M12 3.5C9.8 5.8 8.8 8.6 8.8 12s1 6.2 3.2 8.5" />
    </svg>
  );
}
