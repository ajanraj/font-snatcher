import { HeadContent, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { motion } from "motion/react";
import type { Variants } from "motion/react";

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

const notFoundStagger: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.15 },
  },
};

const notFoundItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] },
  },
};

const spring = { type: "spring" as const, stiffness: 400, damping: 30 };

function RootNotFound() {
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="mx-auto flex min-h-[40vh] max-w-3xl items-center justify-center px-6 py-16"
    >
      <motion.section
        variants={notFoundStagger}
        initial="hidden"
        animate="visible"
        className="w-full rounded-2xl border border-border bg-card p-10 text-center"
      >
        <motion.p
          variants={notFoundItem}
          className="text-[10px] font-light uppercase tracking-[0.3em] text-primary"
        >
          Not Found
        </motion.p>
        <motion.h1
          variants={notFoundItem}
          className="mt-3 font-display text-3xl text-foreground"
        >
          Page does not exist.
        </motion.h1>
        <motion.p
          variants={notFoundItem}
          className="mt-2 text-sm font-light text-muted-foreground"
        >
          Use the main tool home route.
        </motion.p>
        <motion.div variants={notFoundItem}>
          <motion.a
            href="/"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={spring}
            className="mt-6 inline-flex rounded-xl bg-foreground px-5 py-2.5 text-sm font-light text-background transition-colors duration-150 hover:bg-foreground/85"
          >
            Back Home
          </motion.a>
        </motion.div>
      </motion.section>
    </motion.main>
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
