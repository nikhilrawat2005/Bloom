export const runtime = "nodejs";

export async function register() {
  // Next.js statically replaces process.env.NEXT_RUNTIME with a literal in each
  // compilation ("nodejs" | "edge"), so this branch — and the node-only import
  // inside it — is dead-code-eliminated from the edge (and client) bundle.
  // Keeping the node-only work in instrumentation.node.ts is what stops webpack
  // from statically resolving node:crypto / fs / firebase-admin for the edge
  // compile, which previously broke every route in dev.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNode } = await import("./instrumentation.node");
    await registerNode();
  }
}
