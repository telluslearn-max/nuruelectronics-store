"use client";

import { useEffect } from "react";
import { installWebMcpTools } from "@/lib/webmcp/register";

/**
 * Installs NURU's WebMCP tool set on every storefront page so an in-browser
 * agent (ChatGPT's browser, Chrome's WebMCP) can search the catalog, compare
 * products, get NURU / Fit Scores, and assemble a cart — the same capabilities
 * the site's own UI and concierge use. Renders nothing.
 */
export function WebMcpRegistrar() {
  useEffect(() => {
    const installed = installWebMcpTools();
    if (process.env.NODE_ENV !== "production") {
      console.info(`[webmcp] ${installed.toolCount} tools installed via "${installed.transport}"`);
    }
    return installed.dispose;
  }, []);

  return null;
}
