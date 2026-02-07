import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
  compatibilityDate: "2026-02-07",
  preset: "cloudflare-module",
  cloudflare: {
    deployConfig: true,
    nodeCompat: true,
    wrangler: {
      name: "font-snatcher",
      routes: [
        {
          pattern: "fonts.oschat.ai",
          custom_domain: true,
        },
      ],
    },
  },
});
