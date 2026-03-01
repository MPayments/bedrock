import "nextra-theme-docs/style.css";

import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { getPageMap } from "nextra/page-map";

export const metadata = {
  title: "Bedrock Documentation",
  description: "Architecture and runtime documentation for Bedrock",
};

const navbar = (
  <Navbar
    logo={<b>Bedrock Docs</b>}
    projectLink="https://github.com"
  />
);

const footer = <Footer>Bedrock Documentation</Footer>;

function stripDocsPrefix(route: string) {
  if (route === "/docs") {
    return "/";
  }

  return route.startsWith("/docs/") ? route.slice("/docs".length) : route;
}

function normalizePageMapRoutes<T>(items: T[]): T[] {
  return items.map((item: T) => {
    if (!item || typeof item !== "object") {
      return item;
    }

    const value = item as {
      route?: string;
      children?: T[];
    };
    const nextValue = { ...value } as {
      route?: string;
      children?: T[];
    };

    if (typeof nextValue.route === "string") {
      nextValue.route = stripDocsPrefix(nextValue.route);
    }

    if (Array.isArray(nextValue.children)) {
      nextValue.children = normalizePageMapRoutes(nextValue.children);
    }

    return nextValue as T;
  });
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pageMap = normalizePageMapRoutes(await getPageMap("/docs"));

  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body
        style={
          {
            "--nextra-navbar-height": "64px",
          } as React.CSSProperties
        }
      >
        <Layout
          navbar={navbar}
          pageMap={pageMap}
          docsRepositoryBase="https://github.com"
          footer={footer}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
