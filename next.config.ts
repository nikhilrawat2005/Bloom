import type { NextConfig } from "next";

const FIREBASE_ADMIN_EXTERNALS = [
  /^firebase-admin/,
  /^@google-cloud\//,
  /^@grpc\//,
  /^grpc/,
  /^google-auth-library/,
  /^googleapis/,
  /^node-cron/,
];

const nextConfig: NextConfig = {
  turbopack: {},
  serverExternalPackages: [
    "firebase-admin",
    "jwks-rsa",
    "jose",
    "node-cron",
    "@google-cloud/firestore",
    "@google-cloud/storage",
    "grpc",
    "@grpc/grpc-js",
    "google-auth-library",
    "googleapis",
    "pdfkit",
  ],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Mark all firebase-admin and google-cloud packages as browser-side externals
      // (they resolve to undefined on the client, which is correct — they are server-only).
      const existingExternals = config.externals || [];
      config.externals = [
        ...(Array.isArray(existingExternals) ? existingExternals : [existingExternals]),
        ({ request }: { request?: string }, callback: (err?: Error | null, result?: string) => void) => {
          if (request && FIREBASE_ADMIN_EXTERNALS.some((re) => re.test(request))) {
            return callback(null, `commonjs ${request}`);
          }
          callback();
        },
      ];

      // Also set fallbacks for Node built-ins that leak through indirectly
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        stream: false,
        url: false,
        http: false,
        https: false,
        net: false,
        tls: false,
        zlib: false,
        crypto: false,
        os: false,
        child_process: false,
        http2: false,
        dns: false,
        dgram: false,
        readline: false,
        "node:stream": false,
        "node:url": false,
        "node:http": false,
        "node:https": false,
        "node:net": false,
        "node:tls": false,
        "node:crypto": false,
        "node:os": false,
        "node:path": false,
        "node:fs": false,
        "node:zlib": false,
      };
    }
    return config;
  },
};

export default nextConfig;
