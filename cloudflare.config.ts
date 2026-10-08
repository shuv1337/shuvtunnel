import { bindings, defineConfig, defineWorker, exports, triggers } from "cf/config";
import * as entrypoint from "./packages/server/src/index.ts" with { type: "cf-worker" };

// shuvtunnel is one Worker: the relay's API under /api/* and the website (the Vite build of packages/website)
// as static assets for everything else. Preview resources are suffixed with the mode;
// production keeps the two resource names required by FORK.md.
// `cf deploy --mode production` is shuv.zip; any other mode (`cf deploy --mode dev`) is a separate
// Worker, with its own Durable Objects and Workflow, on workers.dev.
export default defineConfig(({ mode = "production" }) => {
  const production = mode === "production";
  const name = production ? "opentunnel-shuv" : `shuvtunnel-${mode}`;
  const domain = production ? "shuv.zip" : `${mode}.shuv.zip`;
  const certificates = production ? "opentunnel-shuv-certificates" : `shuvtunnel-certificates-${mode}`;
  // This Worker, for the bindings to its own classes: referencing the definition rather than the name types them.
  const self = defineWorker({
    name,
    compatibilityDate: "2026-08-08",
    entrypoint,
    exports: {
      TunnelObject: exports.durableObject({ storage: "sqlite" }),
      CertificateWorkflow: exports.workflow({ name: certificates }),
    },
  });
  return {
    worker: {
      ...self,
      compatibilityFlags: ["nodejs_compat"],
      workersDev: !production,
      observability: { enabled: true },
      assets: { runWorkerFirst: ["/api/*"] },
      triggers: production ? [triggers.fetch({ pattern: "shuv.zip/*", zone: "shuv.zip" })] : [],
      env: {
        SHUVTUNNEL_DOMAIN: bindings.text(domain),
        ACME_URL: bindings.text("https://acme.zerossl.com/v2/DV90"),
        ACME_EMAIL: bindings.text("shuv@shuv.dev"),
        ACME_DNS_PROPAGATION_TIMEOUT_MS: bindings.text("10000"),
        CLOUDFLARE_ZONE_ID: bindings.text("c3873d6934c4d42ed652225530ad9cd6"),
        ACME_EAB_KID: bindings.secret(),
        ACME_EAB_HMAC_KEY: bindings.secret(),
        ACME_ACCOUNT_KEY_JWK: bindings.secret(),
        CLOUDFLARE_API_TOKEN: bindings.secret(),
        RELAY_TOKEN: bindings.secret(),
        TUNNELS: bindings.durableObject({ worker: self, exportName: "TunnelObject" }),
        CERTIFICATES: bindings.workflow({ name: certificates, worker: self, exportName: "CertificateWorkflow" }),
      },
    },
  };
});
