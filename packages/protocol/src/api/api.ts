import { HttpApi, OpenApi } from "effect/unstable/httpapi";
import { TunnelGroup } from "./tunnel.js";

export const Api = HttpApi.make("shuvtunnel")
  .add(TunnelGroup)
  .annotateMerge(
    OpenApi.annotations({
      title: "ShuvTunnel API",
      version: "0.1.0",
      description: "Create and manage blind TLS tunnels.",
    }),
  );
