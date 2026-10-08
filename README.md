# ShuvTunnel

ShuvTunnel is a blind TLS tunnel hosted on Cloudflare. Each client receives a
unique `<id>.shuv.zip` hostname and terminates TLS locally, so neither
Cloudflare Workers nor the relay stores the certificate private key or sees
HTTP plaintext.

This is a maintained fork of [anomalyco/opentunnel](https://github.com/anomalyco/opentunnel).
See [FORK.md](FORK.md) for the identity contract, attribution, and release setup.

> [!NOTE]
> We are waiting on the private beta of Cloudflare Spectrum + TCP Workers for
> this to run fully on Cloudflare. Until then, inbound TCP is temporarily
> handled by the temporary TCP relay in `packages/server/relay`.

## Installation

The native release pipeline supports these installation methods. Availability depends
on completing the fork's [release setup](FORK.md#release-setup); published npm 0.1.0
is the old TypeScript CLI. Before publication, build this revision with
`cargo install --path crates/shuvtunnel-cli --locked`.

```bash
curl -fsSL https://shuv.zip/install | sh
brew install shuv1337/tap/shuvtunnel
yay -S shuvtunnel-bin                  # Arch Linux (AUR)
npm install -g shuvtunnel              # or bun / pnpm
cargo install shuvtunnel-cli
```

The pipeline attaches prebuilt binaries for Linux and macOS (x64 and arm64) to each
[GitHub release](https://github.com/shuv1337/shuvtunnel/releases).

Then route a subdomain to a local port. This creates the tunnel on first use
and starts the background service:

```bash
shuvtunnel route add api 3000
```

See [packages/cli](packages/cli) for the full command reference.

## Architecture

- Spectrum accepts public TCP 443 with TLS termination disabled.
- The Worker's `connect(socket)` handler reads only ClientHello metadata and
  routes by SNI.
- One Durable Object per tunnel owns durable metadata, the authenticated bridge
  WebSocket, and active TCP channels.
- A Cloudflare Workflow issues certificates with ZeroSSL using DNS-01.
- The local client owns the certificate private key, terminates TLS, and
  forwards decrypted traffic to the local application.

There are two client implementations that share one protocol:

| Path | What it is |
| --- | --- |
| `crates/shuvtunnel` | Rust client library and wire types; crates.io package name `shuvtunnel` |
| `crates/shuvtunnel-cli` | The `shuvtunnel` CLI and per-profile background service |
| `packages/client` | Pure TypeScript SDK for Bun (`@shuvtunnel/client`) |
| `packages/protocol` | TypeScript schemas, bridge framing, and the HTTP API contract |
| `packages/server` | The Worker's code: API, Durable Objects, certificate Workflow, and the TCP relay |
| `packages/website` | The landing page, served as the Worker's static assets |
| `packages/cli` | npm launcher and publish script for the Rust CLI |

The wire protocol and on-disk layout are specified in
[docs/protocol.md](docs/protocol.md). Both clients are tested against the
shared vectors in `spec/vectors`, so a change to the protocol must update the
spec, the vectors, and both clients.

## Configuration

Everything hosted is one Cloudflare Worker, described by `cloudflare.config.ts`
at the repository root: the API under `/api/*`, and the website (the Vite build
of `packages/website`, with `index.html` at the root) as static assets for
everything else. Every deployment has a mode: `--mode production` uses the
protected Worker and Workflow names in FORK.md on shuv.zip, while any
other mode (`--mode dev`) is a separate Worker, with its own Durable Objects
and Workflow, on workers.dev. Anything that differs between stages switches on
the mode in that file. The config loads with Node 22.18 or later, not Bun.

```bash
bun run ready                      # types, TypeScript checks, and the Worker build
bun run deploy --mode production   # deploy that build (cf deploy --prebuilt)
```

`vite build` builds production by default; build another stage with
`bunx vite build --mode dev`, then `bun run deploy --mode dev`. CI deploys
production on relevant changes to `master` only when `SHUVTUNNEL_DEPLOY_WEBSITE=true`
in this fork. That opt-in now enables the combined API and website deployment.
The deploy script selects Cloudflare account `771240435fb4f1407f2b4669085dc79d`.

The Worker needs these secrets in each mode. They persist across deploys; set
them once with `bun run deploy --mode <mode> --secrets-file secrets.json`:
`ACME_EAB_KID`, `ACME_EAB_HMAC_KEY`, `ACME_ACCOUNT_KEY_JWK`,
`CLOUDFLARE_API_TOKEN` and `RELAY_TOKEN`. `ACME_ACCOUNT_KEY_JWK` is a one-time
P-256 private JWK used as the stable ZeroSSL account identity; it does not need
scheduled rotation. The Cloudflare API token only needs DNS edit access to the
ShuvTunnel zone. `RELAY_TOKEN` must match the TCP relay's.

Tenant TLS is never terminated in the Worker. `*.shuv.zip` resolves to a
TCP relay host running `packages/server/relay/index.mjs`, which carries each
connection over a WebSocket to `/api/relay`; the Worker's `connect(socket)`
handler takes the same connections directly once Spectrum routes
`*.shuv.zip:443` to it with TLS passthrough.

## Development

```bash
bun install
cp .dev.vars.example .dev.vars   # fill in the secrets
bun run dev
```

`bun run dev` runs the site and the Worker together on
`http://127.0.0.1:4190`. With the current beta of `@cloudflare/vite-plugin`
the local Worker runtime does not answer requests (`fetch failed`), so until it
does, deploy a stage instead: `bunx vite build --mode dev && bun run deploy
--mode dev`. Point the CLI at it in a second terminal after
starting a local HTTP application on port 4096:

```bash
export SHUVTUNNEL_API=http://127.0.0.1:4190
bun run shuvtunnel route add api 4096
```

Useful commands:

```bash
bun run test      # Rust and TypeScript tests
bun run ready     # types, TypeScript checks, and the Worker build
bun run deploy --mode production
```
