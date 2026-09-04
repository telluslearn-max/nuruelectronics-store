import { afterEach, describe, expect, it, vi } from "vitest";
import { installWebMcpTools } from "./register";
import { webMcpToolDefs } from "./tool-defs";

/**
 * register.ts has no DOM in the test env, so each case installs a fake host on
 * `globalThis` and tears it down afterwards. What's being pinned: the tools go
 * to `document.modelContext` first (the settled spec), `navigator.modelContext`
 * is the fallback, teardown is an AbortSignal, and the `window.nuruWebMcp`
 * direct-call shim is always present.
 */

type FakeHost = {
  registerTool?: ReturnType<typeof vi.fn>;
  registerTools?: ReturnType<typeof vi.fn>;
  provideContext?: ReturnType<typeof vi.fn>;
  unregisterTool?: ReturnType<typeof vi.fn>;
};

function setDocument(host: FakeHost | null) {
  vi.stubGlobal("document", host ? { modelContext: host } : {});
}
function setNavigator(host: FakeHost | null) {
  vi.stubGlobal("navigator", host ? { modelContext: host } : {});
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete (globalThis as { nuruWebMcp?: unknown }).nuruWebMcp;
  vi.restoreAllMocks();
});

describe("installWebMcpTools", () => {
  it("registers every tool on document.modelContext with a name, schema, execute, and an abort signal", () => {
    const registerTool = vi.fn();
    setDocument({ registerTool });
    setNavigator({ registerTool: vi.fn() }); // present, but document should win

    const result = installWebMcpTools();

    expect(result.transport).toBe("registerTool");
    expect(result.toolCount).toBe(webMcpToolDefs.length);
    expect(registerTool).toHaveBeenCalledTimes(webMcpToolDefs.length);
    const [descriptor, options] = registerTool.mock.calls[0];
    expect(descriptor).toMatchObject({ name: expect.any(String), description: expect.any(String) });
    expect(descriptor.inputSchema.type).toBe("object");
    expect(typeof descriptor.execute).toBe("function");
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it("falls back to navigator.modelContext when document has none", () => {
    const registerTool = vi.fn();
    setDocument(null);
    setNavigator({ registerTool });

    const result = installWebMcpTools();

    expect(result.transport).toBe("registerTool");
    expect(registerTool).toHaveBeenCalledTimes(webMcpToolDefs.length);
  });

  it("dispose() aborts the signal the tools were registered with", () => {
    const registerTool = vi.fn();
    setDocument({ registerTool });

    const result = installWebMcpTools();
    const { signal } = registerTool.mock.calls[0][1] as { signal: AbortSignal };
    expect(signal.aborted).toBe(false);

    result.dispose();
    expect(signal.aborted).toBe(true);
  });

  it("uses the bulk registerTools shape when that's all the host offers", () => {
    const registerTools = vi.fn();
    setDocument({ registerTools });

    const result = installWebMcpTools();

    expect(result.transport).toBe("registerTools");
    expect(registerTools).toHaveBeenCalledTimes(1);
    expect(registerTools.mock.calls[0][0]).toHaveLength(webMcpToolDefs.length);
  });

  it("clears the set via provideContext on dispose for that shape", () => {
    const provideContext = vi.fn();
    setDocument({ provideContext });

    const result = installWebMcpTools();
    expect(result.transport).toBe("provideContext");
    expect(provideContext).toHaveBeenLastCalledWith({ tools: expect.arrayContaining([]) });

    result.dispose();
    expect(provideContext).toHaveBeenLastCalledWith({ tools: [] });
  });

  it("with no host, reports transport 'none' but still exposes window.nuruWebMcp", () => {
    vi.stubGlobal("window", globalThis);

    const result = installWebMcpTools();

    expect(result.transport).toBe("none");
    const shim = (globalThis as { nuruWebMcp?: { tools: unknown[]; call: unknown } }).nuruWebMcp;
    expect(shim?.tools).toHaveLength(webMcpToolDefs.length);
    expect(typeof shim?.call).toBe("function");
    delete (globalThis as { nuruWebMcp?: unknown }).nuruWebMcp;
  });

  it("a tool's execute wraps the run result as MCP text content and traps errors", async () => {
    const registerTool = vi.fn();
    setDocument({ registerTool });
    installWebMcpTools();
    const descriptor = registerTool.mock.calls[0][0] as {
      execute: (input: unknown) => Promise<{ content: { type: string; text: string }[]; isError?: boolean }>;
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } }),
    );
    const ok = await descriptor.execute({ query: "x" });
    expect(ok.content[0]).toEqual({ type: "text", text: expect.stringContaining("ok") });

    fetchSpy.mockRejectedValueOnce(new Error("network down"));
    const bad = await descriptor.execute({ query: "x" });
    expect(bad.isError).toBe(true);
    expect(bad.content[0].text).toContain("network down");
  });
});
