# shuvtunnel

## 0.1.4

### Upstream adoption (not yet published)

- Adopt upstream through `742d51f`: Rust CLI, Bun SDK, certificate renewal, shared
  protocol vectors, unified Cloudflare deployment, and native release channels.
- Commands are now `up`, `down`, `status`, `route add|remove|list`, `serve`, and `delete`.
  No legacy aliases or state migration. This takes upstream's 0.1.4 version;
  there were no fork releases 0.1.1–0.1.3.
- Includes upstream `7464a51` (headless macOS), `8960fa2` (npm launcher),
  `d22e6f8` (crate publishing), and `dee1174` (Homebrew publishing).

## 0.1.0

### Minor Changes

- aa5e197: Rebrand the CLI as ShuvTunnel. The `shuvtunnel` package and binary default to the shuv.zip API and store state under `shuvtunnel` XDG directories. The bridge now negotiates the `shuvtunnel` WebSocket subprotocol.
- `shuvtunnel --version` reports the published package version instead of a hardcoded `0.0.0`.

The entries below are upstream release history inherited at the fork point.

## 0.0.30

### Patch Changes

- aac6b95: Publish the new Open Tunnel CLI under the transferred npm package.
