// Isolate credential RPC mocks from the application transforms.
export default {
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  test: { include: ["src/lib/credentials-email.functions.test.ts"] },
};