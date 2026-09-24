import { createServer } from "node:net";

const token = process.env.RELAY_TOKEN;
if (!token) throw new Error("RELAY_TOKEN is required");

const relayUrl = new URL(process.env.RELAY_URL ?? "wss://shuv.zip/api/relay");
relayUrl.searchParams.set("token", token);
const port = Number(process.env.LISTEN_PORT ?? 8443);
const host = process.env.LISTEN_HOST ?? "127.0.0.1";

const server = createServer({ allowHalfOpen: true }, (socket) => {
  console.log(`TCP client ${socket.remoteAddress}:${socket.remotePort}`);
  socket.pause();
  const bridge = new WebSocket(relayUrl);
  bridge.binaryType = "arraybuffer";

  bridge.addEventListener("open", () => {
    console.log("Worker relay connected");
    socket.resume();
  });
  bridge.addEventListener("message", (event) => {
    if (typeof event.data === "string") {
      try {
        if (JSON.parse(event.data).type === "end") socket.end();
      } catch {
        socket.destroy(new Error("Invalid relay control message"));
      }
      return;
    }
    socket.write(Buffer.from(event.data));
  });
  bridge.addEventListener("close", (event) => {
    console.error(`Worker relay closed: ${event.code} ${event.reason}`);
    socket.destroy();
  });
  bridge.addEventListener("error", (event) => {
    console.error("Worker relay error", event.error ?? event.message ?? event);
    socket.destroy();
  });

  // WebSocket.send throws while the bridge is still connecting. The socket stays paused until the
  // bridge opens, so an early "end" means the client left without sending anything (e.g. a port scan).
  socket.on("data", (chunk) => {
    if (bridge.readyState !== WebSocket.OPEN) return socket.destroy();
    console.log(`Forwarding ${chunk.length} bytes to Worker`);
    bridge.send(chunk);
  });
  socket.on("end", () => {
    if (bridge.readyState === WebSocket.OPEN) bridge.send(JSON.stringify({ type: "end" }));
    else bridge.close();
  });
  socket.on("error", () => bridge.close());
  socket.on("close", () => bridge.close());
});

server.listen(port, host, () => {
  console.log(`ShuvTunnel relay listening on ${host}:${port}`);
});
