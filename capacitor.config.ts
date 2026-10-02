import type { CapacitorConfig } from "@capacitor/cli";

// One GitHub codebase; native releases bundle local assets and never load a remote shell.
const config: CapacitorConfig = {
  appId: "lab.tunetots.field",
  appName: "FIELD",
  webDir: "dist",
  ios: { contentInset: "never" },
  server: { iosScheme: "capacitor" },
};
export default config;
