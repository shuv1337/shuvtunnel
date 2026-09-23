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

export interface ShuvTunnelRoute {
  readonly name: string;
  readonly hostname: string;
  readonly target: string;
}

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
  | { readonly type: "connected" }
  | { readonly type: "disconnected"; readonly reason?: string }
  | { readonly type: "route-open"; readonly route: string; readonly connection: number }
  | { readonly type: "route-close"; readonly route: string; readonly connection: number };

export interface ShuvTunnelConnection {
  readonly tunnel: ShuvTunnelIdentity;
  readonly routes: ReadonlyArray<ShuvTunnelRoute>;
  readonly events: Stream.Stream<ShuvTunnelClientEvent>;
  readonly closed: Effect.Effect<void>;
  readonly close: Effect.Effect<void>;
}

export interface ShuvTunnelEffectClient {
  readonly profile: {
    readonly list: () => Effect.Effect<ReadonlyArray<string>, ShuvTunnelError>;
  };
  readonly route: {
    readonly list: (
      options?: ShuvTunnelProfileOptions,
    ) => Effect.Effect<ReadonlyArray<ShuvTunnelRoute>, ShuvTunnelError>;
    readonly add: (
      options: ShuvTunnelProfileOptions & { readonly name: string; readonly target: string },
    ) => Effect.Effect<ShuvTunnelRoute, ShuvTunnelError>;
    readonly remove: (
      options: ShuvTunnelProfileOptions & { readonly name: string },
    ) => Effect.Effect<void, ShuvTunnelError>;
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
        readonly name?: string;
        readonly onProgress?: (stage: ShuvTunnelProvisionStage) => void;
      },
    ) => Effect.Effect<ShuvTunnelIdentity, ShuvTunnelError>;
    readonly ensure: (
      options?: ShuvTunnelProfileOptions & { readonly name?: string },
    ) => Effect.Effect<ShuvTunnelIdentity, ShuvTunnelError>;
    readonly remove: (
      options?: ShuvTunnelProfileOptions,
    ) => Effect.Effect<void, ShuvTunnelError>;
    readonly connect: (
      options?: ShuvTunnelProfileOptions & { readonly signal?: AbortSignal },
    ) => Effect.Effect<ShuvTunnelConnection, ShuvTunnelError, Scope.Scope>;
  };
}
