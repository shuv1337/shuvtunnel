import type { Effect, Scope, Stream } from "effect";
import type { ShuvTunnelError } from "./errors.js";

export interface ShuvTunnelProfileOptions {
  readonly profile?: string;
}

export type ShuvTunnelProvisionStage =
  | "creating-tunnel"
  | "generating-key"
  | "generating-csr"
  | "resuming-certificate"
  | "requesting-certificate"
  | "waiting-certificate"
  | "saving-identity"
  | "ready";

/** Route name (`@` for the tunnel hostname, or a subdomain label) to `host:port`. */
export type ShuvTunnelRoutes = Readonly<Record<string, string>>;

export interface ShuvTunnelIdentity {
  readonly id: string;
  readonly hostname: string;
  readonly token: string;
  readonly privateKey: string;
  readonly certificate: string;
  readonly chain: string;
  readonly certificateExpiry: Date;
}

export interface ShuvTunnelPendingIdentity {
  readonly id: string;
  readonly hostname: string;
  readonly token: string;
  readonly privateKey: string;
  readonly csr: string;
}

export interface ShuvTunnelStoredTunnel {
  readonly profile: string;
  readonly tunnel: ShuvTunnelIdentity;
}

export type ShuvTunnelClientEvent =
  | { readonly type: "connecting"; readonly attempt: number }
  | { readonly type: "connected"; readonly session: string; readonly routes: ReadonlyArray<string> }
  | { readonly type: "disconnected"; readonly reason: string }
  | { readonly type: "reconnecting"; readonly attempt: number; readonly delayMs: number }
  | { readonly type: "connection-opened"; readonly conn: number; readonly route: string; readonly peer: string }
  | { readonly type: "connection-closed"; readonly conn: number; readonly route: string; readonly error?: string }
  | { readonly type: "certificate-renewed"; readonly expiry: string }
  | { readonly type: "stopped"; readonly error?: string };

export interface ShuvTunnelStatus {
  readonly state: "waiting-routes" | "connecting" | "connected" | "reconnecting" | "stopped";
  readonly hostname: string;
  readonly routes: ShuvTunnelRoutes;
  readonly session?: string;
  readonly connections: number;
  readonly lastError?: string;
  /** Unix milliseconds of the last successful attach. */
  readonly connectedAt?: number;
}

export interface ShuvTunnelConnectOptions extends ShuvTunnelProfileOptions {
  readonly routes: ShuvTunnelRoutes;
}

export interface ShuvTunnelConnection {
  readonly tunnel: ShuvTunnelIdentity;
  readonly events: Stream.Stream<ShuvTunnelClientEvent>;
  readonly status: Effect.Effect<ShuvTunnelStatus>;
  readonly setRoutes: (routes: ShuvTunnelRoutes) => Effect.Effect<void, ShuvTunnelError>;
  /** Completes when the tunnel stops after a fatal error or is closed. */
  readonly closed: Effect.Effect<void, ShuvTunnelError>;
  readonly close: Effect.Effect<void>;
}

export interface ShuvTunnelEffectClient {
  readonly profile: {
    readonly list: () => Effect.Effect<ReadonlyArray<string>, ShuvTunnelError>;
  };
  readonly tunnel: {
    readonly list: () => Effect.Effect<ReadonlyArray<ShuvTunnelStoredTunnel>, ShuvTunnelError>;
    readonly get: (
      options?: ShuvTunnelProfileOptions,
    ) => Effect.Effect<ShuvTunnelIdentity | undefined, ShuvTunnelError>;
    readonly pending: (
      options?: ShuvTunnelProfileOptions,
    ) => Effect.Effect<Pick<ShuvTunnelPendingIdentity, "id" | "hostname"> | undefined, ShuvTunnelError>;
    readonly resume: (
      options?: ShuvTunnelProfileOptions & {
        readonly onProgress?: (stage: ShuvTunnelProvisionStage) => void;
      },
    ) => Effect.Effect<ShuvTunnelIdentity | undefined, ShuvTunnelError>;
    readonly create: (
      options?: ShuvTunnelProfileOptions & {
        readonly onProgress?: (stage: ShuvTunnelProvisionStage) => void;
      },
    ) => Effect.Effect<ShuvTunnelIdentity, ShuvTunnelError>;
    readonly ensure: (
      options?: ShuvTunnelProfileOptions,
    ) => Effect.Effect<ShuvTunnelIdentity, ShuvTunnelError>;
    readonly remove: (
      options?: ShuvTunnelProfileOptions,
    ) => Effect.Effect<void, ShuvTunnelError>;
    /**
     * Starts forwarding routes for the profile's tunnel, creating it if
     * needed. Succeeds once the bridge first attaches and keeps reconnecting
     * until the scope closes.
     */
    readonly connect: (
      options: ShuvTunnelConnectOptions,
    ) => Effect.Effect<ShuvTunnelConnection, ShuvTunnelError, Scope.Scope>;
  };
}
