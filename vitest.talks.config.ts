// Isolate Talk RPC tests from application server-function transforms.
export default {
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  test: { include: ["src/lib/talk-attendance.test.ts", "src/lib/admin-talks.functions.test.ts"] },
};