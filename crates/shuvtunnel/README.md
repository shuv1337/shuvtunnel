# shuvtunnel

Rust client for [ShuvTunnel](https://github.com/shuv1337/shuvtunnel): blind
TLS tunnels on Cloudflare. TLS terminates in your process, so the relay never
sees plaintext or the private key.

```rust
let client = shuvtunnel::Client::default();
client.ensure("default").await?;
let routes = [("api".to_string(), "127.0.0.1:3000".to_string())].into();
let mut tunnel = client.connect("default", routes)?;
let mut events = tunnel.subscribe();
tunnel.wait().await?;
```

`Client` creates and stores tunnels per profile under
`$XDG_DATA_HOME/shuvtunnel`, in the same layout as the TypeScript SDK and CLI.
`Tunnel` keeps one bridge session connected, reconnects with backoff, accepts
route changes with `set_routes`, and picks up certificates the server renews.
