import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "VITE_");
  const apiOrigin = new URL(
    env.VITE_FIELD_API_URL || "https://field-api.nikolachenmusic.workers.dev",
  ).origin;
  return {
    plugins: [
      react(),
      {
        name: "field-content-policy",
        apply: "build",
        transformIndexHtml() {
          // The standalone session is private client state. Restrict executable
          // scripts to the app bundle and the existing official Telegram SDK.
          return [
            {
              tag: "meta",
              attrs: {
                "http-equiv": "Content-Security-Policy",
                content: `default-src 'self'; script-src 'self' https://telegram.org; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob: data:; connect-src 'self' ${apiOrigin}; object-src 'none'; base-uri 'self'; form-action 'none'`,
              },
              injectTo: "head-prepend",
            },
          ];
        },
      },
      {
        name: "field-native-local-shell",
        transformIndexHtml(html) {
          return env.VITE_FIELD_PLATFORM === "ios"
            ? html.replace(
                /<script[^>]+src="https:\/\/telegram.org\/js\/telegram-web-app.js[^>]*><\/script>/,
                "",
              )
            : html;
        },
      },
    ],
  };
});
