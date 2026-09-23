# ShuvTunnel fork boundary

ShuvTunnel is a maintained fork of OpenTunnel. This file is the identity
contract for the fork. `scripts/check-fork-boundary.ts` enforces it, and it runs
as part of `bun run ready` and CI.

## Provenance

| | |
| --- | --- |
| Upstream | [anomalyco/opentunnel](https://github.com/anomalyco/opentunnel) (`upstream` remote, push disabled) |
| Fork | [shuv1337/shuvtunnel](https://github.com/shuv1337/shuvtunnel) (`origin` remote) |
| Forked from | `e0ce6c649a74c9293e1c09130f60efa1f8e06b97` (`perf(website): 60 Hz in Safari`, 2026-09-22), after upstream release `opentunnel@0.0.30` |
| License | MIT, as declared in upstream's package metadata. Upstream ships no standalone LICENSE file. Credit for the original design and implementation goes to the OpenTunnel authors. |

The upstream commit history is preserved. Entries in `packages/cli/CHANGELOG.md`
up to and including 0.0.30 are upstream OpenTunnel releases.

## Canonical identity

These names are what the fork ships and documents:

| Surface | Value |
| --- | --- |
| Product / display name | ShuvTunnel (`shuvtunnel` in lowercase contexts, `SHUVTUNNEL` wordmark) |
| npm CLI package and binary | `shuvtunnel` |
| Workspace scope | `@shuvtunnel/{root,client,protocol,server,website}` |
| Repository | `https://github.com/shuv1337/shuvtunnel` |
| Default API / tunnel domain | `https://shuv.zip`, `<id>.shuv.zip` |
| Relay default | `wss://shuv.zip/api/relay` |
| TypeScript symbols | `ShuvTunnel*` (for example `ShuvTunnelClient`, `ShuvTunnelStorage`) |
| Effect service keys | `@shuvtunnel/<package>/<Symbol>` |
| Environment variables | `SHUVTUNNEL_DOMAIN` (Worker var), `SHUVTUNNEL_DAEMON` (CLI daemon marker), `SHUVTUNNEL_API_URL` (`.env.example`) |
| Bridge WebSocket subprotocol | `shuvtunnel` |
| HTTP API name | `shuvtunnel`, titled "ShuvTunnel API" |
| XDG directories | `$XDG_{CONFIG,DATA,STATE,RUNTIME}_HOME/shuvtunnel/` and the runtime fallback `$TMPDIR/shuvtunnel-<uid>` |
| Website | `shuvtunnel-website` Worker on `shuv.zip/*`, with the `shuvtunnel-landing-preview` preview Worker |

## Compatibility identifiers (kept deliberately)

| Identifier | Where | Why |
| --- | --- | --- |
| `opentunnel-shuv` | Worker script name in `packages/server/wrangler.jsonc` | The deployed Worker holds the secrets and Durable Object state. Renaming it would deploy a new, empty Worker. |
| `opentunnel-shuv-certificates` | Certificate Workflow name | Paired with the deployed Worker. Renaming it would orphan in-flight Workflow instances. |

Renaming either one is a deliberate migration: create the new Worker, copy the
secrets, redeploy, and accept that existing tunnels are lost.

## Deliberate deltas from upstream

1. Full rebrand to ShuvTunnel across package names, the binary, TypeScript
   symbols, environment variables, the WebSocket subprotocol, XDG paths, docs,
   and the website.
2. The deployment targets the `shuv.zip` zone in Cloudflare account
   `771240435fb4f1407f2b4669085dc79d`.
3. Certificate issuance is split into durable Workflow steps. DNS propagation
   and ACME polling use `step.sleep` instead of in-step waits.
4. CI publishing and website deployment are opt-in. `publish.yml` needs the
   repository variable `SHUVTUNNEL_NPM_PUBLISH=true`, and `deploy-website.yml`
   needs `SHUVTUNNEL_DEPLOY_WEBSITE=true` plus Cloudflare secrets. Both workflows
   run only in `shuv1337/shuvtunnel`.

## Wire-compatibility consequences

The WebSocket subprotocol changed from `opentunnel` to `shuvtunnel`, and the
server now reads `SHUVTUNNEL_DOMAIN`. Deploy the server before shipping clients
built from this revision. Upstream `opentunnel` clients cannot bridge to a
ShuvTunnel server, and the reverse is also true.

Local state does not migrate. ShuvTunnel reads `~/.config/shuvtunnel` and
related paths, not `~/.config/opentunnel`. To keep an existing identity, copy
the profile directories across.

## Upstream sync policy

Upstream merges are expected. To sync:

```sh
git fetch upstream
jj new master@upstream master   # or: git merge upstream/master
```

When resolving conflicts, apply the rename mapping to the incoming code:
`@opentunnel/` → `@shuvtunnel/`, `OpenTunnel` → `ShuvTunnel`,
`openTunnel` → `shuvTunnel`, `OPENTUNNEL` → `SHUVTUNNEL`,
`opentunnel.xyz` → `shuv.zip`, `opentunnel` → `shuvtunnel`. Leave the
compatibility identifiers above unchanged. Then run `bun run ready`. The
boundary check fails if retired branding comes back or a protected identifier
disappears.

Regenerate the share card after website changes with
`bun --cwd packages/website run og`.
