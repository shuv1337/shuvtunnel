- This codebase uses Effect v4 (`4.0.0-beta.42`, pinned by the root catalog and `bun.lock`), which is not documented yet.
- Do not rely on your own knowledge of Effect (e.g. don't use `Effect.gen` if the codebase uses a different pattern).
- The source of truth for Effect APIs is the pinned copy that `bun install` puts in each package, e.g. `packages/client/node_modules/effect/src`. Search it for similar services, layers, and composition patterns, and copy those. A newer Effect checkout elsewhere on disk has different APIs; do not copy from it.
- `bunfig.toml` enables exact dependency versions.
- Run commands in the most granular package you are testing, not at the root (e.g. `cd packages/protocol && bun run build` instead of `bun run ready` from the root).
- Common commands: `bun run build` (build for production), `bun run test` (run tests).

## Clients

- There are two client implementations: Rust (`crates/`) and the TypeScript SDK (`packages/client`, Bun only).
- The CLI and background service are Rust (`crates/shuvtunnel-cli`). `packages/cli` only contains the npm launcher and the publish script that generates the per-platform packages.
- `docs/protocol.md` is the source of truth for the wire protocol and on-disk layout. Protocol changes must update the spec, `spec/vectors`, and both clients.
- Rust checks: `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`.
- Rust uses the `ring` crypto provider everywhere; do not add dependencies that pull in `aws-lc-rs`, since it complicates cross-compiling.

## Cloudflare Runtime

- The hosted application is one Worker, configured by the root `cloudflare.config.ts` and built by the root `vite.config.ts` (Cloudflare Vite plugin): `packages/server` is its code (HTTP handlers, inbound TCP, Durable Objects, a certificate Workflow) and `packages/website` its static assets.
- Keep runtime-neutral schemas, bridge framing, and HTTP contracts in `packages/protocol`.
- Keep API handlers, TLS parsing, Durable Objects, and Workflows in `packages/server`.
- Spectrum must use TLS passthrough; never move tenant TLS termination into the Worker.
- `cloudflare.config.ts` switches on `mode`; preview resources are named `<name>-<mode>`, and production uses the names in FORK.md. It loads with Node 22.18 or later, not Bun.
- Run `bun run types` at the root after changing bindings.
- `bun run ready` at the root builds everything; `bun run deploy --mode <mode>` deploys that build.

## Fork Boundary

- This is ShuvTunnel, a fork of anomalyco/opentunnel. `FORK.md` is the identity contract.
- Keep the deployed Worker name `opentunnel-shuv` and Workflow `opentunnel-shuv-certificates` unchanged.
- Adopt upstream behavior without backward-compatibility layers; existing tunnels are test data.
- Run `bun run check:fork` after upstream merges or rename work; `bun run ready` includes it.

## Rules and what enforces them

| Rule | Enforced by |
| --- | --- |
| Fork identity only: no upstream names outside the FORK.md exceptions, including in cherry-picked files such as changesets. | `bun run check:fork` (in `bun run ready`, CI `check` job) |
| The Cargo workspace version equals `packages/cli` and both crate entries in `Cargo.lock`. | `bun run check:fork` |
| Versions come from their manifest, never a hand-copied string: Rust uses `env!("CARGO_PKG_VERSION")`; the SDK's `src/effect/version.ts` is generated from its `package.json` by `bun run version`. | SDK test `attaches with the published package version`; publish scripts refuse stale workspace versions |
| Wire messages, routes, names and frames match `spec/vectors` in both clients. | `packages/protocol/test/vectors.test.ts`, `crates/shuvtunnel/tests/vectors.rs` |
| Effect code follows the pinned `effect` source in `node_modules`. | Nothing; judgment |
