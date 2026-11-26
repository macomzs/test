import type { NextConfig } from "next";
import path from "node:path";

// Wspólny plik .env w katalogu głównym repozytorium (zmienne już ustawione w systemie mają pierwszeństwo).
try {
  process.loadEnvFile(path.join(import.meta.dirname, "../../.env"));
} catch {
  // brak pliku .env – np. na hostingu, gdzie zmienne ustawia się w panelu
}

const config: NextConfig = {
  // Obraz Dockera używa trybu "standalone" (minimalny serwer); lokalnie wystarcza "next start".
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  transpilePackages: ["@app/db", "@app/domain", "@app/platform", "@app/services"],
  serverExternalPackages: ["@node-rs/argon2", "pg", "pg-boss"],
  poweredByHeader: false,
  // GitHub Codespaces udostępnia aplikację pod adresem *.app.github.dev – zezwalamy na niego
  // w trybie deweloperskim i dla formularzy (Server Actions).
  allowedDevOrigins: ["*.app.github.dev"],
  experimental: {
    serverActions: {
      allowedOrigins: process.env.CODESPACES ? ["*.app.github.dev", "localhost:3000"] : [],
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default config;
