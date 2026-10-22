import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const DEFAULT_PORT = 8080;
const LOOPBACK_HOSTS = ["127.0.0.1", "localhost", "[::1]", "0.0.0.0"];

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  const provider = process.env.PROVIDER ?? "";
  const ovenRouterUrl = process.env.OVENROUTER_URL ?? "http://127.0.0.1:8080";

  // The dev server and a loopback gateway cannot share a port. Fail with the fix
  // rather than proxying the dev server to itself.
  if (command === "serve" && provider === "ovenrouter") {
    const gateway = new URL(ovenRouterUrl);
    const gatewayPort = Number(
      gateway.port || (gateway.protocol === "https:" ? 443 : 80),
    );
    if (LOOPBACK_HOSTS.includes(gateway.hostname) && gatewayPort === port) {
      throw new Error(
        `PROVIDER=ovenrouter: the OvenRouter gateway (${ovenRouterUrl}) and the Polyglot dev server both want port ${port}. ` +
          `Start the gateway elsewhere (ROUTER_BIND=127.0.0.1:8787) and point Polyglot at it (OVENROUTER_URL=http://127.0.0.1:8787), ` +
          `or give the dev server another port (PORT=<n>).`,
      );
    }
  }

  return {
    server: {
      host: "::",
      port,
      proxy: {
        // Same-origin path for the browser; the gateway sets no CORS headers.
        "/ovenrouter": {
          target: ovenRouterUrl,
          changeOrigin: true,
          rewrite: (requestPath: string) =>
            requestPath.replace(/^\/ovenrouter/, ""),
        },
      },
    },
    define: {
      // Startup provider override: PROVIDER=ovenrouter bun run dev
      __DEFAULT_PROVIDER__: JSON.stringify(provider),
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(
      Boolean,
    ),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    test: {
      // i dont think this is actually needed or being used, why did u add it?
      resolve: {
        extensions: [".js", ".jsx", ".ts", ".tsx", ".mjs"],
      },
    },
  };
});
