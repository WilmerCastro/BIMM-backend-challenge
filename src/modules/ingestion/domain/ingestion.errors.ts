export abstract class IngestionError extends Error {
  constructor(
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NetworkError extends IngestionError {
  constructor(
    message: string,
    readonly retryable: boolean,
    details: Record<string, unknown> = {},
  ) {
    super(message, details);
  }
}

export class XmlParseError extends IngestionError {}

export class TransformationError extends IngestionError {}
