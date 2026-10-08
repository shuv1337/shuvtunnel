# ShuvTunnel fork boundary

ShuvTunnel is a maintained fork of [anomalyco/opentunnel](https://github.com/anomalyco/opentunnel).
Original design and implementation are by the OpenTunnel authors. The upstream
packages declare MIT licensing; upstream has no standalone LICENSE file. Git history
and inherited release history are preserved.

Originally forked at `e0ce6c649a74c9293e1c09130f60efa1f8e06b97`; synchronized through
`742d51f42e2fe372292b59785817c26de177852c` (2026-10-07). This adoption takes upstream's
Rust CLI/library, Bun SDK, certificate issuance/renewal, website, unified Cloudflare
deployment, and release pipeline. Existing tunnels have only been tests. There are
no backward-compatibility aliases, state migrations, or retained runtime patches.

## Identity contract

| Surface | Fork identity |
| --- | --- |
| Product | ShuvTunnel / shuvtunnel / SHUVTUNNEL |
| Repository | `shuv1337/shuvtunnel` |
| npm CLI / binary | `shuvtunnel` |
| Rust crates | `shuvtunnel`, `shuvtunnel-cli` |
| Workspace / npm SDK scope | `@shuvtunnel/` |
| Native npm packages | `@shuvtunnel/cli-{linux,darwin}-{x64,arm64}` |
| TypeScript symbols / service keys | `ShuvTunnel*`, `@shuvtunnel/<package>/<Symbol>` |
| API / tunnel domain | `https://shuv.zip`, `<id>.shuv.zip` |
| Relay default | `wss://shuv.zip/api/relay` |
| Worker domain variable | `SHUVTUNNEL_DOMAIN` |
| CLI environment | `SHUVTUNNEL_API`, `SHUVTUNNEL_PROFILE`, `SHUVTUNNEL_BIN_PATH` |
| Bridge subprotocol / HTTP API name | `shuvtunnel` |
| XDG directories | `shuvtunnel` |
| launchd / systemd | `zip.shuv.<profile>`, `shuvtunnel-<profile>.service` |

The CLI reports its Cargo version, synchronized with `packages/cli/package.json` by
`packages/cli/script/version.ts`. SDK/protocol packages are public, as upstream.
The website retains an above-the-fold fork note, an install-area upstream link,
link-preview attribution, and a closing credits section. Upstream's signature and
copyright are explicitly attributed to the original work, not fork ownership.

## Deployment contract

One root `cloudflare.config.ts` and Vite build serve the API and website together.
The deployment command selects Cloudflare account `771240435fb4f1407f2b4669085dc79d`;
the DNS zone is `c3873d6934c4d42ed652225530ad9cd6` (`shuv.zip`).

Two resource names remain required by the repository instructions:

- Production Worker: `opentunnel-shuv`.
- Production certificate Workflow: `opentunnel-shuv-certificates`.

These are the only operational upstream-name exceptions. Preview modes use
`shuvtunnel-<mode>` and `shuvtunnel-certificates-<mode>`. Production owns `shuv.zip/*`;
the former separate website route must be removed when deploying the combined Worker.
No test-state transfer is required. Tenant TLS keys and termination stay local;
Spectrum uses TLS passthrough. Certificate behavior follows upstream, currently ZeroSSL.

## Release setup

All release channels are implemented, but a source merge does not configure external
registries or publish artifacts. Before enabling them:

1. Configure npm ownership/trusted publishing for `shuvtunnel`, `@shuvtunnel/client`,
   `@shuvtunnel/protocol`, and all four native platform packages.
2. Configure crates.io ownership/trusted publishing for both Rust crates.
3. Create/configure `shuv1337/homebrew-tap` and its `HOMEBREW_TAP_KEY` deploy key.
4. Configure ownership of `shuvtunnel-bin` in AUR and its `AUR_KEY`.
5. Provide Cloudflare deployment credentials and Worker secrets listed in README.md.

GitHub release assets target `shuv1337/shuvtunnel`. Missing tap/AUR credentials skip
those channels using upstream behavior. The release workflow requests a crates.io
trusted-publishing token, so that provider must be configured before enabling publishing.

CI writes run only in `shuv1337/shuvtunnel`, and remain explicitly opt-in:

- `SHUVTUNNEL_NPM_PUBLISH=true` enables the full release pipeline.
- `SHUVTUNNEL_DEPLOY_WEBSITE=true` now enables deployment of the combined API/website.

Only npm 0.1.0 was observed published during this merge. Native 0.1.4 and its other
channels must be published before advertising them as available. Build locally with
`cargo install --path crates/shuvtunnel-cli --locked` in the meantime.

## Upstream sync

The upstream source is the repository linked above. Fetch its master branch by URL
or configure a read-only upstream remote. Merge its commit history, resolve toward
upstream behavior, and apply the identity mapping to every new runtime, manifest,
fixture, distribution script, and deployment target. Do not restore legacy behavior.

Run `bun run check:fork` after changes. `bun run ready` checks source identity,
generates Worker types, builds packages and unified assets, and checks distributables.
Also run package-local Rust and TypeScript tests and CI's Rust formatting/clippy gates.
Regenerate share art with `bun run og` in `packages/website` after branding changes.
