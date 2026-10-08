# ShuvTunnel CLI

The `shuvtunnel` CLI manages one tunnel identity and a set of subdomain routes
per profile, and runs a background service that keeps them connected. It is a
native binary written in Rust (`crates/shuvtunnel-cli`); this npm package is a
small launcher that runs the prebuilt binary for your platform.

These install channels require the fork release setup in [FORK.md](../../FORK.md#release-setup).
Before the native release is published, build with `cargo install --path crates/shuvtunnel-cli --locked`
from the repository root. npm 0.1.0 is the previous TypeScript CLI.

```bash
curl -fsSL https://shuv.zip/install | sh
brew install shuv1337/tap/shuvtunnel
yay -S shuvtunnel-bin
npm install -g shuvtunnel
cargo install shuvtunnel-cli
```

Prebuilt binaries are published for Linux and macOS on x64 and arm64.

## Commands

```bash
shuvtunnel route add api 3000            # api.<hostname> → 127.0.0.1:3000, brings the tunnel up
shuvtunnel route add @ 127.0.0.1:8080    # the hostname itself
shuvtunnel route remove api
shuvtunnel route list
shuvtunnel status                        # tunnel, routes, and connection
shuvtunnel up                            # connect: create the tunnel if needed, start the service
shuvtunnel down                          # disconnect: stop the service
shuvtunnel serve                         # run in the foreground (containers, debugging)
shuvtunnel delete --yes                  # delete the tunnel for good, losing its hostname
```

Every command takes `--profile <name>` (or `SHUVTUNNEL_PROFILE`) and defaults to
the `default` profile. A profile is one tunnel, so one URL per device is the
norm; apps using `@shuvtunnel/client` add their own routes to the same tunnel.

## Background service

`up` (and `route add`) creates the tunnel if needed and starts the background
service. Where systemd (Linux) or launchd (macOS) is available, the service is
registered to start at login as `shuvtunnel-<profile>.service` or
`zip.shuv.<profile>`; elsewhere, such as in containers, it runs as a
plain background process until the next reboot. `down` stops it and removes
the registration.

The service reconnects with backoff, applies route edits (including hand
edits to the config file) within a few seconds, and picks up certificates the
server renews without dropping connections. Its log is shown by
`shuvtunnel status`.

## Files

Configuration is declarative, contains no credentials, and is safe to commit to
a dotfiles repository. The filename is the profile name:

```toml
# $XDG_CONFIG_HOME/shuvtunnel/default.toml
[routes]
api = "127.0.0.1:3000"
"@" = "127.0.0.1:8080"
```

Generated identity and credentials are stored separately, readable only by
you, and must not be committed. This layout is shared with
`@shuvtunnel/client`:

```text
$XDG_DATA_HOME/shuvtunnel/<profile>/
  tunnel.json  token  private-key.pem  certificate.pem  chain.pem
  pending.json        (only while certificate verification is pending)
```

Runtime state:

```text
$XDG_STATE_HOME/shuvtunnel/<profile>/daemon.log
$XDG_STATE_HOME/shuvtunnel/<profile>/last-error.json
$XDG_RUNTIME_DIR/shuvtunnel/<profile>.sock   control socket
$XDG_RUNTIME_DIR/shuvtunnel/<profile>.lock   single-instance lock
```

Without XDG variables, the defaults are `~/.config`, `~/.local/share`, and
`~/.local/state`.

## Development

From the repository root, `bun run shuvtunnel -- info` runs the CLI with Cargo.

Releases follow the same pattern as other Anomaly CLIs: CI builds one binary
per platform into `dist/cli-<os>-<arch>/bin/shuvtunnel`, then:

- `script/publish.ts` publishes each `@shuvtunnel/cli-<os>-<arch>` package and
  the `shuvtunnel` launcher with those packages as `optionalDependencies`;
- `script/release.ts` creates the GitHub release with one tarball per platform
  (used by the install script at `packages/website/public/install`), updates
  the formula in `shuv1337/homebrew-tap` (with that repository's deploy key,
  the org-level `HOMEBREW_TAP_KEY` secret), and pushes the `shuvtunnel-bin`
  AUR package (the org-level `AUR_KEY` secret);
- `script/crates.ts` publishes the `shuvtunnel` and `shuvtunnel-cli` crates
  through crates.io trusted publishing.

Steps without credentials are skipped.
