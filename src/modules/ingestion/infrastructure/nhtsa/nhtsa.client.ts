import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { withRetry } from '../../../../common/resilience/retry.js';
import type { Env } from '../../../../config/env.js';
import type {
  MakeSummary,
  VehicleType,
} from '../../../vehicles/domain/make.js';
import { NetworkError } from '../../domain/ingestion.errors.js';
import { parseMakesXml, parseVehicleTypesXml } from './nhtsa-xml.parser.js';

const isRetryableStatus = (status: number) => status === 429 || status >= 500;

@Injectable()
export class NhtsaClient {
  private readonly logger = new Logger(NhtsaClient.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async getAllMakes(): Promise<MakeSummary[]> {
    const source = 'getallmakes';
    return parseMakesXml(await this.fetchXml(`${source}?format=xml`, source));
  }

  async getVehicleTypes(makeId: number): Promise<VehicleType[]> {
    const source = `GetVehicleTypesForMakeId/${makeId}`;
    const xml = await this.fetchXml(`${source}?format=xml`, source);
    return parseVehicleTypesXml(xml, makeId);
  }

  private fetchXml(path: string, source: string) {
    return withRetry(() => this.request(path, source), {
      retries: this.config.get('NHTSA_MAX_RETRIES', { infer: true }),
      baseDelayMs: this.config.get('NHTSA_RETRY_BASE_DELAY_MS', { infer: true }),
      shouldRetry: (error) => error instanceof NetworkError && error.retryable,
      onRetry: (error, attempt, delayMs) =>
        this.logger.warn(
          { source, attempt, delayMs, err: error },
          'Retrying NHTSA request',
        ),
    });
  }

  private async request(path: string, source: string): Promise<string> {
    const url = `${this.config.get('NHTSA_BASE_URL', { infer: true })}/${path}`;
    const timeoutMs = this.config.get('NHTSA_TIMEOUT_MS', { infer: true });

    let response: Response;
    let body: string;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      body = await response.text();
    } catch (error) {
      throw new NetworkError(`Request to ${source} failed`, true, {
        source,
        cause: error instanceof Error ? error.message : String(error),
      });
    }

    if (!response.ok) {
      throw new NetworkError(
        `${source} responded with status ${response.status}`,
        isRetryableStatus(response.status),
        { source, status: response.status },
      );
    }

    return body;
  }
}
