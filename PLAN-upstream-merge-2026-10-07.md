# Upstream merge plan — 2026-10-07

## Confirmed direction

Adopt upstream in full, applying only the changes necessary for ShuvTunnel's fork
contract. The user confirmed that all existing tunnels are test tunnels and there
are no production users. Existing test state may be discarded; backward compatibility
is not an acceptance criterion.

This replaces the earlier selective-adoption recommendation. Adopt the Rust CLI,
Bun SDK, certificate implementation and renewal, unified `cf` deployment, website,
and full release pipeline. Do not retain the old CLI, command aliases, SDK API,
Wrangler layout, separate website deployment, or fork-specific runtime patches.
Do not add state migration or old-client interoperability work.

Implementation completed locally on `merge/upstream-2026-10-07` on 2026-10-08.
Deployment, registry setup and publication are separate rollout work. Existing test
resources have not been modified. See the execution receipt below.

## Verified baseline

| Item | Observed value |
| --- | --- |
| Fork branch / starting commit | `master`, `19f0534374489594a99ab5bb8e4650cf4029b5d5` |
| Upstream target | `742d51f42e2fe372292b59785817c26de177852c`, dated 2026-10-07 |
| Common ancestor | `e0ce6c649a74c9293e1c09130f60efa1f8e06b97` |
| Divergence | 24 upstream commits; 10 fork commits |
| Upstream change footprint | 127 files; 9,579 additions; 1,892 deletions |
| Merge simulation | 29 conflicting paths |
| Worktree before planning | Clean; `master` matched locally recorded `origin/master` |
| Remotes | Only `origin` exists, despite FORK.md describing an upstream remote |
| Installed tools | Bun 1.4.2; Rust 1.95.0 |

Upstream was fetched directly from the repository identified in FORK.md. A
`git merge-tree` simulation inspected conflicts without changing index/worktree.
Use the pinned SHA above, not a potentially changed `FETCH_HEAD`.

## Remaining fork contract

- ShuvTunnel identity: package/crate/binary names, TypeScript symbols, service keys,
  env vars, local paths, bridge subprotocol, website branding, and fork repository.
- Our Cloudflare account/zone and `shuv.zip` endpoints; all release destinations
  must belong to the fork. Upstream attribution and license provenance remain.
- Spectrum TLS passthrough and client-side tenant TLS termination/private keys.
- Fork-repository-only CI and the existing explicit publishing/deployment opt-ins,
  adapted to the unified pipeline rather than preserving obsolete jobs.
- The current repository instructions explicitly require the two deployed resource
  names listed in FORK.md to stay unchanged. Carry those names into the production
  `cf` config; this is a remaining contract exception, not a state-migration project.

Revise FORK.md during implementation: its durable-step implementation, private SDK
packages, separate website Workers, old version source, and legacy deployment
directions no longer describe the intended fork. Keep the contract focused on
identity, ownership, provenance, and the explicitly required resource names.

## Upstream changes being adopted

- `54e2493`: Rust CLI/library, Bun SDK, protocol specification/vectors, renewal,
  service lifecycle, native distributions.
- `4db992a`: Bun >=1.4 for the in-process TLS path; use upstream's Bun 1.4.2 pin.
  Effect stays at 4.0.0-beta.42.
- `156a434`, `a428969`: root `cf`/Vite configuration; one Worker for API and website.
- `ff93cfc`: relay early-disconnect fix, guarded sends, delayed half-close delivery.
- `7464a51`: macOS launchd GUI-domain detection and background-process fallback.
- `5330c7e`: WebCrypto CSR generation and release lock/version checks.
- Website scene updates, Firefox fixes, mobile overflow fixes, and font remeasurement.
- npm launcher/platform packages, SDK/protocol packages, GitHub assets, crates.io,
  Homebrew, and AUR release integration.

## Implementation sequence

### 1. Merge using upstream as the behavioral baseline

- [x] Recheck state; create an integration branch/worktree from the recorded fork SHA.
- [x] Configure the read-only upstream remote from FORK.md, or correct its remote
  instructions if continuing to fetch by URL.
- [x] Merge the pinned target with `--no-commit --no-ff`.
- [x] Resolve source/layout conflicts toward upstream, then apply the fork identity
  mapping. Inspect clean merges too: obsolete downstream guards can survive them.
- [x] Preserve Git history and attribution; do not keep implementation patches merely
  because they were previously documented as deliberate deltas.

Acceptance: upstream architecture and behavior are the baseline, with an explainable
fork-only diff and no parallel legacy implementation.

### 2. Adopt unified deployment

- [x] Adopt incoming root `cloudflare.config.ts`, `vite.config.ts`, `index.html`,
  `.dev.vars.example`, root dev/build/types/deploy scripts, and `.github/workflows/deploy.yml`.
- [x] Apply our account, zone, domain, secrets references, production resource names,
  and ShuvTunnel preview-mode naming. Verify config semantics against the installed
  upstream-pinned `cf` package before adapting bindings.
- [x] Accept deletion of server/website Wrangler configs, website-local Vite config,
  `.env.example`, and `.github/workflows/deploy-website.yml`. Adopt generated
  `.cloudflare/types` and upstream TypeScript/build configuration.
- [x] Adapt deployment CI to our repository and existing deployment opt-in. Document
  that it now controls the combined API/website deployment.
- [ ] At rollout, inspect existing test routes and remove conflicting separate-website
  routing so the new Worker owns `shuv.zip/*`. Inventory exact obsolete test resources
  before cleanup; no state transfer is required.

Acceptance: one supported deployment path; root assets and API build together;
bindings and routes resolve to fork-owned resources; preview modes are isolated.

### 3. Adopt CLI, SDK, protocol, and certificates

Proposed renamed incoming crate directories: `crates/shuvtunnel` and
`crates/shuvtunnel-cli`; neither exists in current HEAD.

- [x] Rename crate directories/manifests/imports, Cargo references, binaries, launcher,
  service labels, URLs, env vars, test identities, and wire constants consistently.
- [x] Accept deletion of `packages/cli/src/{config,index,service}.ts` and client
  `src/effect/bridge.ts`. Adopt the native commands and new SDK `connect`/route API.
- [x] Adopt incoming `packages/client/src/effect/{client,tunnel,csr,types}.ts`, promise
  API/exports, shared protocol names/vectors, and Rust implementations.
- [x] Adopt upstream `packages/server/src/certificate-workflow.ts`, renewal changes
  in `stored-tunnel.ts`/`tunnel-object.ts`, and relay implementation. Drop the fork's
  durable-step rewrite and pending-deletion patch instead of porting them into Rust.
- [x] Keep upstream's current ZeroSSL configuration, changing only fork-specific
  account/email/domain values. Local functional tests use synthetic identities;
  live issuance remains a deployment smoke test.
- [x] Preserve the upstream-pinned Effect version. If adaptation requires behavioral
  Effect edits, verify beta.42 source/declarations first: the instructed external
  checkout was absent, and discovered alternate checkouts were newer versions.

Acceptance: a fresh native CLI and SDK work with the merged server using our
identities/endpoints. No legacy command aliases or old-state upgrade requirements.

### 4. Adopt the complete release model

- [x] Adapt `packages/cli/script/{publish,release,version,crates}.ts`, SDK publishing,
  root release/version scripts, changesets, and publishing CI to fork destinations.
- [x] Adopt public SDK/protocol packages and native npm optional dependencies.
  Update FORK.md's obsolete private-package requirement.
- [ ] Configure fork-owned npm scope/packages, crates.io names/trusted publishing,
  GitHub release assets, Homebrew tap, and AUR package targets. Missing ownership,
  credentials, or repository targets are setup tasks, not reasons to drop a channel.
- [x] Retain repository/opt-in checks while adapting the complete upstream job graph.
  Inspect every external destination; upstream credentials/tap URLs must not survive.
- [x] Align CLI/Cargo versions with incoming 0.1.4 and its version synchronization
  mechanism, after checking fork registry versions for collisions. Do not introduce
  a compatibility-motivated 0.2.0 release. Preserve historical changelog provenance.
- [x] Regenerate Bun/Cargo locks after identity and manifest resolution. Keep exact
  Bun dependency versions and frozen/locked CI installs.
- [x] Validate artifacts without executing publishing scripts that write to registries.
  Advertise only install channels whose fork destinations/assets are actually available.

Acceptance: all upstream release channels are implemented for the fork; configured
channels are verifiable, and any remaining external setup is recorded explicitly.

### 5. Update website and fork enforcement

- [x] Adopt upstream website behavior/design, applying ShuvTunnel branding and required
  credit. Preserve honest author/license attribution without implying upstream ownership
  of the fork. Move preview attribution checks to root `index.html`.
- [x] Adapt `packages/website/public/install` to fork release assets and native naming.
- [x] Rewrite `scripts/check-fork-boundary.ts` around Rust manifests, native launcher,
  release destinations, root `cf` config and unified built assets. Remove assertions
  for deleted TS CLI sources, `dist/index.js`, and Wrangler files.
- [x] Keep narrow attribution exceptions and checks for the remaining contract.
- [x] Update FORK.md, README.md, package READMEs and AGENTS.md for the adopted
  architecture; remove superseded compatibility/deployment instructions.
- [x] Regenerate website share art with `bun run og` in `packages/website`.

## Validation

Use package-local commands where possible; root `cf`/Vite and Cargo workspace
checks are inherently workspace-wide. The execution receipt distinguishes completed
checks from rollout work.

| Directory | Command/check | Required signal |
| --- | --- | --- |
| Root | `bun install --frozen-lockfile` | Resolved manifests and lock agree |
| Root | `bun run check:fork` | Revised identity/ownership checks pass |
| Root | `bun run types` | Unified Worker binding declarations generated |
| `packages/protocol` | `bun run build`, `bun run test` | Types and shared vectors pass |
| `packages/client` | `bun run build`, `bun run test` | SDK/CSR/tunnel tests pass |
| `packages/server` | `bun run build` | Worker typecheck passes with root-generated types |
| `packages/website` | `bun run build` | Website typecheck passes |
| Root | `bunx vite build` | Combined Worker/assets bundle succeeds |
| `crates/shuvtunnel` (proposed) | `cargo test --locked` | Library/vector/tunnel tests pass |
| `crates/shuvtunnel-cli` (proposed) | `cargo test --locked`, `cargo build --release --locked` | Native CLI passes |
| Root | `cargo fmt --all --check`, `cargo clippy --workspace --all-targets --locked -- -D warnings` | Rust CI checks pass |
| Root | Revised fork distributable checks; `git diff --check` | Artifacts respect contract; clean diff |

Verify native platform matrix, isolated launcher install/help/version/signals, fresh
XDG setup, route edits, reconnect, local TLS forwarding, certificate provisioning
and renewal, and relay early disconnects. Browser-check unified routing, mobile
overflow, Firefox diagram clicks, credit, and share previews.

Earlier static review flagged empty-route readiness, close-during-refresh persistence,
and stale-renewal alarm recovery as possible upstream issues. These are not reasons
to preserve old fork implementations. Reproduce only as needed for functional
acceptance; track independent upstream bugs separately from identity adaptation.

## Rollout

1. Complete merged builds, tests and contract updates.
2. Provision required secrets and deploy the combined Worker with fork configuration.
3. Verify website/API/relay and create new test tunnels; existing test tunnels can
   be recreated rather than migrated.
4. Publish verified artifacts through the adopted fork release pipeline.
5. Remove enumerated obsolete test deployment resources after the replacement works.

Before commit, rollback is `git merge --abort` in the integration workspace. Record
the merged deployment version for ordinary release rollback. No old-client, daemon,
certificate, or local-profile compatibility project is required.

## Execution receipt — 2026-10-08

- All 29 conflicts resolved toward the pinned upstream snapshot before reapplying
  fork identity/ownership. No retained downstream client/certificate runtime patches.
- `bun install --frozen-lockfile`, Worker type generation, all four TypeScript package
  builds, and the unified production Vite Worker/assets build passed.
- TypeScript: 11 client tests and 5 protocol tests passed. Rust: 14 library/integration
  tests plus one doctest passed; CLI test target passed (no tests upstream).
- `cargo fmt --all --check`, workspace clippy with warnings denied, and a native
  release build passed. Isolated-XDG version/help/status/route-list smoke checks passed.
- npm launcher dispatched to the release binary and reported `shuvtunnel 0.1.4`.
  SDK tarball inspection confirmed `@shuvtunnel/protocol` resolves to 0.1.0 and Effect
  to beta.42 rather than workspace/catalog placeholders. Nothing was published.
- Fork source/distributable checks passed, including generated Worker names, Workflow,
  DO owner, domain and production route. npm lookup found only existing CLI 0.1.0.
- Chromium built-site smoke passed at 390px and 1440px: no page errors or horizontal
  overflow, install selector works, diagram sound toggles twice, credit and metadata
  are present. Firefox was unavailable; its upstream fix is adopted but not locally tested.
- Share card regenerated. Its script needed the new root entrypoint and standalone
  React/Vite configuration because upstream deleted the former website Vite config.
- Two mechanical rename misses were fixed (mixed-case SNI fixture and Homebrew class).
  The extra fork-credit link overflowed upstream's install tab row on mobile; allowing
  that row to wrap fixed the measured regression. Rust imports were formatter-sorted.
- Remaining rollout checks: Linux/x64 native CI matrix, live Worker provisioning and
  certificate renewal, registry/trusted-publisher setup, tap/AUR ownership, route cleanup,
  deployment and publication. None are represented as completed by this source merge.

## Rollout receipt — 2026-10-08

- Pushed merge `ce59c1f` to `origin/master`. GitHub check run `37755931219`
  passed, and publish run `37755931315` built all four Linux/macOS ARM64/x64 binaries.
- Reassigned the existing `shuv.zip/*` route from `shuvtunnel-website` to
  the combined production Worker, resolving the deployment conflict. Deploy run `37755931236`
  passed on retry. The old website Worker is retained without that route.
- Published GitHub release `v0.1.4` with the four CI-built native archives.
  The live curl installer downloaded and ran the macOS ARM64 binary successfully.
- A fresh test tunnel obtained a real certificate and forwarded HTTPS to a local
  HTTP server through the published binary. Deleted the exact test tunnel afterward.
  The isolated-XDG test used foreground serving after launchd did not start within
  the CLI timeout; normal login-service behavior and certificate renewal are not verified.
- Registry publication is blocked: crates.io rejected the workflow's trusted-publisher
  exchange. No local npm login/token is available. Homebrew tap repository/key and
  AUR credentials are also unconfigured. GitHub release publication succeeded separately;
  the Publish workflow is still failed, not green.

## Done when

The pinned upstream history is incorporated in full, fork-only differences are
limited to the current identity/ownership/provenance contract, upstream architecture
and release channels are adopted, validation passes, and any external publishing
setup still needed is stated precisely.
