import { HeadContent, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";

import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import { createThemeInitScript } from "../lib/theme";

import appCss from "../styles.css?url";

import type { QueryClient } from "@tanstack/react-query";

interface MyRouterContext {
  queryClient: QueryClient;
}

const themeInitScript = createThemeInitScript();
const SITE_URL = "https://fonts.oschat.ai";
const SITE_TITLE = "Font Snatcher";
const SITE_DESCRIPTION =
  "Extract web fonts from public sites. Preview, download, and find legal alternatives.";
const OG_IMAGE_URL = `${SITE_URL}/og-image.png?v=20260207-3`;

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        name: "color-scheme",
        content: "dark light",
      },
      {
        title: SITE_TITLE,
      },
      {
        name: "description",
        content: SITE_DESCRIPTION,
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        property: "og:site_name",
        content: SITE_TITLE,
      },
      {
        property: "og:title",
        content: SITE_TITLE,
      },
      {
        property: "og:description",
        content: SITE_DESCRIPTION,
      },
      {
        property: "og:url",
        content: SITE_URL,
      },
      {
        property: "og:image",
        content: OG_IMAGE_URL,
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
      {
        name: "twitter:title",
        content: SITE_TITLE,
      },
      {
        name: "twitter:description",
        content: SITE_DESCRIPTION,
      },
      {
        name: "twitter:image",
        content: OG_IMAGE_URL,
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "canonical",
        href: SITE_URL,
      },
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/favicon.svg?v=20260207-2",
      },
      {
        rel: "shortcut icon",
        href: "/favicon.ico?v=20260207-2",
      },
      {
        rel: "apple-touch-icon",
        href: "/logo192.png?v=20260207-2",
      },
      {
        rel: "manifest",
        href: "/manifest.json?v=20260207-2",
      },
    ],
  }),

  shellComponent: RootDocument,
  notFoundComponent: RootNotFound,
});

function RootNotFound() {
  return (
    <main className="mx-auto flex min-h-[40vh] max-w-3xl items-center justify-center px-6 py-16">
      <section className="w-full rounded-2xl border border-slate-200 bg-white/90 p-8 text-center shadow-sm">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Not Found</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">Page does not exist.</h1>
        <p className="mt-2 text-sm text-slate-600">Use the main tool home route.</p>
        <a
          href="/"
          className="mt-5 inline-flex rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Back Home
        </a>
      </section>
    </main>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const isProduction = import.meta.env.PROD;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }}></script>
        <HeadContent />
        {isProduction ? (
          <script
            defer
            src="https://umami.ajanraj.com/script.js"
            data-website-id="a0d86aeb-f338-47f5-bf5e-0e0aa5c8739f"
          ></script>
        ) : null}
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}
