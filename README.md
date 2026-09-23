# ShuvTunnel

ShuvTunnel is a blind TLS tunnel hosted on Cloudflare. Each client receives a
unique `<id>.shuv.zip` hostname and terminates TLS locally, so neither
Cloudflare Workers nor the relay stores the certificate private key or sees
HTTP plaintext.

ShuvTunnel is a maintained fork of
[anomalyco/opentunnel](https://github.com/anomalyco/opentunnel). See
[FORK.md](FORK.md) for provenance, the deliberate deltas, the identifiers kept
for compatibility, and the upstream-sync policy.

> [!NOTE]
> Running fully on Cloudflare depends on the private beta of Cloudflare
> Spectrum + TCP Workers. Until that is available, inbound TCP is handled by
> the temporary relay in `packages/server/relay`.

## Installation

The CLI requires [Bun](https://bun.sh):

```bash
bun install -g shuvtunnel
```

Then create a tunnel and route traffic to a local process:

```bash
shuvtunnel create
shuvtunnel route add api 127.0.0.1:3000
```

See [packages/cli](packages/cli) for the full command reference.

## Architecture

- Spectrum accepts public TCP 443 with TLS termination disabled.
- The Worker's `connect(socket)` handler reads only ClientHello metadata and
  routes by SNI.
- One Durable Object per tunnel owns durable metadata, the authenticated bridge
  WebSocket, and active TCP channels.
- A Cloudflare Workflow issues certificates with ZeroSSL using DNS-01.
- The local bridge owns the certificate private key and forwards decrypted
  traffic to the local application.

Shared schemas, bridge framing, and the Effect HTTP API contract live in
`packages/protocol`. Server handlers, ClientHello routing, Cloudflare runtime,
and the temporary relay live in `packages/server`. The local proxy lives in
`packages/client` and is exposed through `packages/cli`.

## Configuration

Set Worker secrets before deploying:

```bash
cd packages/server
bunx wrangler secret put ACME_EAB_KID
bunx wrangler secret put ACME_EAB_HMAC_KEY
bunx wrangler secret put ACME_ACCOUNT_KEY_JWK
bunx wrangler secret put CLOUDFLARE_API_TOKEN
```

`ACME_ACCOUNT_KEY_JWK` is a one-time P-256 private JWK used as the stable
ZeroSSL account identity; it does not need scheduled rotation. The Cloudflare
API token only needs DNS edit access to the `shuv.zip` zone. The zone ID, other
non-secret defaults, Durable Object binding, certificate Workflow, and apex API
route are defined in `packages/server/wrangler.jsonc`. The deployed Worker keeps
the script name `opentunnel-shuv` (and the Workflow `opentunnel-shuv-certificates`)
so its secrets and Durable Object state survive the rebrand.

Spectrum must route `*.shuv.zip:443` to this Worker with `tls: off`. That
Worker-backed Spectrum target is currently provisioned through Cloudflare's
inbound TCP Workers beta rather than Wrangler configuration.

For local development, copy `.env.example` to the ignored
`packages/server/.dev.vars` and fill in the secret values.

## Development

```bash
bun install
bun run cf-typegen
bun run dev
```

The local Worker listens on `http://localhost:8787`. Run the demo bridge in a
second terminal after starting a local HTTP application on port 4096:

```bash
bun run shuvtunnel create
bun run shuvtunnel route add api http://127.0.0.1:4096
bun run shuvtunnel connect
```

Useful commands:

```bash
bun run ready
bun run deploy
```

`bun run ready` runs the fork-boundary check, then every package's tests,
TypeScript checks, and a Wrangler dry-run bundle.

## License

MIT, as declared by upstream OpenTunnel. See [FORK.md](FORK.md) for
attribution.
