import { Effect, Layer, ServiceMap } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";
import { Api } from "@shuvtunnel/protocol/api/api";
import { Tunnel } from "@shuvtunnel/protocol/tunnel";

type Client = HttpApiClient.ForApi<typeof Api>;

interface ShuvTunnelApi {
  readonly client: Client;
  readonly authorized: (token: Tunnel.Token) => Effect.Effect<Client>;
}

export class ShuvTunnelApiClient extends ServiceMap.Service<ShuvTunnelApiClient, ShuvTunnelApi>()(
  "@shuvtunnel/client/ShuvTunnelApiClient",
) {
  static layer(options: { readonly api: URL | string }) {
    return Layer.effect(
      ShuvTunnelApiClient,
      Effect.gen(function* () {
        const httpClient = yield* HttpClient.HttpClient;
        const client = yield* HttpApiClient.makeWith(Api, {
          baseUrl: options.api,
          httpClient,
        });
        return {
          client,
          authorized: (token) =>
            HttpApiClient.makeWith(Api, {
              baseUrl: options.api,
              httpClient: httpClient.pipe(
                HttpClient.mapRequest(HttpClientRequest.bearerToken(token)),
              ),
            }),
        };
      }),
    ).pipe(Layer.provide(FetchHttpClient.layer));
  }
}
