import type { ReactNode } from "react";
import { telegram } from "../telegram";
// Real links remain usable even if the Telegram SDK is present in Safari
// without signed Mini App data. Navigation stays inside a user gesture.
export function TelegramLink({
  href,
  children,
  className = "primary-button",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => {
        if (telegram.isTelegram && window.Telegram?.WebApp?.openTelegramLink) {
          event.preventDefault();
          telegram.openChat(href);
        }
      }}
    >
      {children}
    </a>
  );
}
