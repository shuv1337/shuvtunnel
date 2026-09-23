import { ServiceMap } from "effect";
import { HttpApiMiddleware, HttpApiSecurity } from "effect/unstable/httpapi";
import { Tunnel } from "../tunnel.js";
import { UnauthorizedError } from "./errors.js";

export class ShuvTunnelAuthorizationToken extends ServiceMap.Service<
  ShuvTunnelAuthorizationToken,
  Tunnel.Token
>()("@shuvtunnel/protocol/ShuvTunnelAuthorizationToken") {}

export class ShuvTunnelAuthorization extends HttpApiMiddleware.Service<
  ShuvTunnelAuthorization,
  { provides: ShuvTunnelAuthorizationToken }
>()("@shuvtunnel/protocol/ShuvTunnelAuthorization", {
  security: { bearer: HttpApiSecurity.bearer },
  error: UnauthorizedError,
}) {}
