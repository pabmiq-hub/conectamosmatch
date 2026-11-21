// Keep RPC unit-test mocks independent of TanStack Start's application transforms.
export default {
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  test: { include: ["src/lib/selection-reminder*.test.ts"] },
};