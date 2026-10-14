export abstract class IngestionError extends Error {
  constructor(
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class XmlParseError extends IngestionError {}

export class TransformationError extends IngestionError {}
