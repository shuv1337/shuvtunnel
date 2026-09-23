export * as Authorization from "./auth.js";

import { Effect, Layer, Redacted } from "effect";
import { ShuvTunnelAuthorization, ShuvTunnelAuthorizationToken } from "@shuvtunnel/protocol/api/auth";
import { Tunnel } from "@shuvtunnel/protocol/tunnel";

export const layer = Layer.succeed(
  ShuvTunnelAuthorization,
  ShuvTunnelAuthorization.of({
    bearer: (httpEffect, { credential }) =>
      httpEffect.pipe(
        Effect.provideService(
          ShuvTunnelAuthorizationToken,
          Tunnel.Token.makeUnsafe(Redacted.value(credential)),
        ),
      ),
  }),
);
