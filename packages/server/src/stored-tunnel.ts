import type { Certificate } from "@shuvtunnel/protocol/certificate";
import type { CSR } from "@shuvtunnel/protocol/csr";
import type { Tunnel } from "@shuvtunnel/protocol/tunnel";

export interface StoredTunnel {
  readonly version: 1;
  readonly id: Tunnel.ID;
  readonly hostname: CSR.Hostname;
  readonly state: Tunnel.State;
  readonly certificateID?: Certificate.ID;
  readonly tokenHash: string;
  readonly createdAt: string;
  readonly deletedAt?: string;
  readonly certificate?: Certificate.Info;
  readonly certificateCsr?: string;
  readonly certificateIdentifiers?: ReadonlyArray<string>;
  /** Set on every successful bridge attach; renewals skip tunnels idle longer than a certificate lifetime. */
  readonly lastConnectedAt?: string;
  /** A renewal issuing alongside the current certificate, which keeps serving until it completes. */
  readonly renewal?: {
    readonly certificateID: Certificate.ID;
    readonly startedAt: string;
  };
}
