import { webMcpToolDefs, type WebMcpToolDef } from "@/lib/webmcp/tool-defs";

/**
 * Binds NURU's tool set (tool-defs.ts) to the browser's WebMCP surface.
 *
 * The WebMCP standard (webmachinelearning/webmcp) settled on
 * `document.modelContext.registerTool(descriptor, { signal })`, where the
 * descriptor is `{ name, description, inputSchema, execute }`, `execute` gets
 * the argument object plus `{ signal }` and returns
 * `{ content: [{ type: "text", text }] }`, and a tool is removed by aborting
 * the signal it was registered with. Chrome 149+ (behind
 * `chrome://flags/#enable-webmcp-testing`) and ChatGPT's in-app browser are the
 * judged runtimes; earlier drafts and some hosts put the object on `navigator`
 * or expose a bulk `registerTools` / `provideContext`, so this stays defensive
 * about where the host object lives and which method it offers.
 *
 * With no WebMCP host present it still exposes the tools on `window.nuruWebMcp`
 * so a demo page or a test can invoke them directly.
 */

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

type ModelContextLike = {
  registerTool?: (tool: unknown, options?: { signal?: AbortSignal }) => unknown;
  registerTools?: (tools: unknown[], options?: { signal?: AbortSignal }) => void;
  provideContext?: (context: { tools: unknown[] }) => void;
  unregisterTool?: (name: string) => void;
};

/** The spec puts `modelContext` on `document`; older drafts and some hosts use `navigator`. Take whichever exists. */
function resolveHost(): ModelContextLike | null {
  if (typeof document !== "undefined") {
    const fromDocument = (document as unknown as { modelContext?: ModelContextLike }).modelContext;
    if (fromDocument) return fromDocument;
  }
  if (typeof navigator !== "undefined") {
    const fromNavigator = (navigator as unknown as { modelContext?: ModelContextLike }).modelContext;
    if (fromNavigator) return fromNavigator;
  }
  return null;
}

function toWebMcpTool(def: WebMcpToolDef) {
  return {
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema,
    // The spec passes the argument object directly (a second `{ signal }` arg,
    // which we don't need, follows); a few hosts still wrap the args as
    // `{ arguments }` / `{ params }`, so unwrap those before handing them on.
    async execute(input: unknown): Promise<ToolResult> {
      const args =
        input && typeof input === "object"
          ? ((input as Record<string, unknown>).arguments ??
              (input as Record<string, unknown>).params ??
              input)
          : {};
      try {
        const result = await def.run((args ?? {}) as Record<string, unknown>);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (error) {
        return {
          content: [
            { type: "text", text: JSON.stringify({ error: error instanceof Error ? error.message : "Tool failed." }) },
          ],
          isError: true,
        };
      }
    },
  };
}

export type WebMcpInstallResult = {
  /** How the tools were surfaced: the host API used, or "none" when only the window fallback is available. */
  transport: "registerTool" | "registerTools" | "provideContext" | "none";
  toolCount: number;
  /** Removes everything this call installed. */
  dispose: () => void;
};

/** Registers NURU's WebMCP tools with the current browser. Safe to call on any page; returns a disposer. */
export function installWebMcpTools(): WebMcpInstallResult {
  const tools = webMcpToolDefs.map(toWebMcpTool);

  // Always expose a direct-call fallback for demos / tests / hosts that read a
  // global rather than the modelContext object. Not torn down on dispose — it's
  // a harmless global that the next mount overwrites, and removing it in an
  // effect cleanup would leave it gone under React's strict-mode timing.
  if (typeof window !== "undefined") {
    (window as unknown as { nuruWebMcp?: unknown }).nuruWebMcp = {
      tools: webMcpToolDefs.map((d) => ({ name: d.name, description: d.description, inputSchema: d.inputSchema })),
      call: (name: string, args: Record<string, unknown> = {}) => {
        const def = webMcpToolDefs.find((d) => d.name === name);
        if (!def) return Promise.reject(new Error(`Unknown tool "${name}"`));
        return def.run(args);
      },
    };
  }

  const host = resolveHost();
  // One controller for the whole set — aborting it unregisters every tool, which
  // is how the spec says teardown works.
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  let transport: WebMcpInstallResult["transport"] = "none";

  if (host && typeof host.registerTool === "function") {
    transport = "registerTool";
    for (const tool of tools) {
      try {
        // May return a Promise (spec), a disposable, or nothing — we don't need
        // the return value; teardown goes through the AbortSignal.
        const returned = host.registerTool(tool, controller ? { signal: controller.signal } : undefined);
        void Promise.resolve(returned).catch(() => {
          /* a host that rejects one registration shouldn't break the rest */
        });
      } catch {
        /* skip a tool the host rejects synchronously */
      }
    }
  } else if (host && typeof host.registerTools === "function") {
    transport = "registerTools";
    host.registerTools(tools, controller ? { signal: controller.signal } : undefined);
  } else if (host && typeof host.provideContext === "function") {
    transport = "provideContext";
    host.provideContext({ tools });
  }

  return {
    transport,
    toolCount: tools.length,
    dispose: () => {
      controller?.abort();
      // provideContext hosts have no signal contract — clear the set explicitly.
      if (transport === "provideContext") host?.provideContext?.({ tools: [] });
      else if (transport === "registerTools" && typeof host?.unregisterTool === "function") {
        for (const tool of tools) host.unregisterTool(tool.name);
      }
    },
  };
}
