import { webMcpToolDefs, type WebMcpToolDef } from "@/lib/webmcp/tool-defs";

/**
 * Binds NURU's tool set (tool-defs.ts) to the browser's WebMCP surface.
 *
 * WebMCP (`navigator.modelContext`) is an emerging standard and its exact shape
 * still varies between the ChatGPT browser, Chrome, and the polyfills, so this
 * is deliberately defensive: it tries `registerTool` (per-tool, returns a
 * disposable), falls back to `provideContext`/`registerTools` (whole set), and
 * normalises both the argument shape passed to a tool and the result shape it
 * must return. When no WebMCP host is present it installs nothing but still
 * exposes the tools on `window.nuruWebMcp` so a demo page or a test can invoke
 * them directly.
 */

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

type ModelContextLike = {
  registerTool?: (tool: unknown) => { unregister?: () => void } | void;
  registerTools?: (tools: unknown[]) => void;
  provideContext?: (context: { tools: unknown[] }) => void;
  unregisterTool?: (name: string) => void;
};

function toWebMcpTool(def: WebMcpToolDef) {
  return {
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema,
    // Host implementations differ on whether the tool gets the args object
    // directly or wrapped as `{ arguments }` / `{ params }`.
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
          content: [{ type: "text", text: JSON.stringify({ error: error instanceof Error ? error.message : "Tool failed." }) }],
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
  const disposers: (() => void)[] = [];

  // Always expose a direct-call fallback for demos / tests / hosts that read a
  // global rather than navigator.modelContext. Not torn down on dispose — it's
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

  const mc =
    typeof navigator !== "undefined"
      ? ((navigator as unknown as { modelContext?: ModelContextLike }).modelContext ?? null)
      : null;

  let transport: WebMcpInstallResult["transport"] = "none";

  if (mc && typeof mc.registerTool === "function") {
    transport = "registerTool";
    for (const tool of tools) {
      const handle = mc.registerTool(tool);
      disposers.push(() => {
        if (handle && typeof handle.unregister === "function") handle.unregister();
        else if (typeof mc.unregisterTool === "function") mc.unregisterTool(tool.name);
      });
    }
  } else if (mc && typeof mc.registerTools === "function") {
    transport = "registerTools";
    mc.registerTools(tools);
    disposers.push(() => tools.forEach((t) => mc.unregisterTool?.(t.name)));
  } else if (mc && typeof mc.provideContext === "function") {
    transport = "provideContext";
    mc.provideContext({ tools });
    disposers.push(() => mc.provideContext?.({ tools: [] }));
  }

  return {
    transport,
    toolCount: tools.length,
    dispose: () => disposers.forEach((d) => d()),
  };
}
