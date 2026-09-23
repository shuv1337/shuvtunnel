import { Schema } from "effect";

export class ShuvTunnelClientError extends Schema.TaggedErrorClass<ShuvTunnelClientError>()(
  "ShuvTunnelClientError",
  { message: Schema.String, cause: Schema.optional(Schema.Defect) },
) {}

export class ShuvTunnelStorageError extends Schema.TaggedErrorClass<ShuvTunnelStorageError>()(
  "ShuvTunnelStorageError",
  { message: Schema.String, cause: Schema.optional(Schema.Defect) },
) {}

export type ShuvTunnelError = ShuvTunnelClientError | ShuvTunnelStorageError;
