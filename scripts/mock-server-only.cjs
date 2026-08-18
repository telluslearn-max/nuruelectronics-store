// Mock `server-only`, `next/headers`, `next/cache` for standalone script execution in node/tsx
const Module = require("module");
const originalRequire = Module.prototype.require;

const cookieMap = new Map();

const mockCookies = {
  get: (name) => {
    const val = cookieMap.get(name);
    return val !== undefined ? { name, value: val } : undefined;
  },
  set: (name, value) => {
    cookieMap.set(name, typeof value === "object" ? value.value : value);
  },
  delete: (name) => {
    cookieMap.delete(name);
  },
  getAll: () => {
    return Array.from(cookieMap.entries()).map(([name, value]) => ({ name, value }));
  },
};

Module.prototype.require = function (id) {
  if (id === "server-only") {
    return {};
  }
  if (id === "next/headers") {
    return {
      cookies: async () => mockCookies,
      headers: async () => new Headers(),
    };
  }
  if (id === "next/cache") {
    return {
      revalidatePath: () => {},
      revalidateTag: () => {},
    };
  }
  return originalRequire.apply(this, arguments);
};
