# @shuvtunnel/protocol

Inherited upstream release notes, with fork package names. These entries do not
indicate publication of the fork's protocol package.

## 0.1.0

### Minor Changes

- 54e2493: First public release of the ShuvTunnel SDK for Bun. `client.tunnel.connect({ routes })` creates the device's tunnel on first use, terminates TLS in-process, reconnects with backoff, and picks up renewed certificates. Several apps and the CLI can share one tunnel by serving different routes.

  Requires Bun 1.4.0 or later.
