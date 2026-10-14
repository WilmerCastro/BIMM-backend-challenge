import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRateLimiter } from '../../../../common/resilience/rate-limiter.js';
import { withRetry } from '../../../../common/resilience/retry.js';
import type { Env } from '../../../../config/env.js';
import type {
  MakeSummary,
  VehicleType,
} from '../../../vehicles/domain/make.js';
import {
  NetworkError,
  SourceBlockedError,
} from '../../domain/ingestion.errors.js';
import type { VehicleCatalogSource } from '../../domain/vehicle-catalog.source.js';
import { parseMakesXml, parseVehicleTypesXml } from './nhtsa-xml.parser.js';

const isRetryableStatus = (status: number) => status === 429 || status >= 500;

@Injectable()
export class NhtsaClient implements VehicleCatalogSource {
  private readonly logger = new Logger(NhtsaClient.name);
  private readonly waitForTurn: () => Promise<void>;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.waitForTurn = createRateLimiter(
      config.get('NHTSA_REQUESTS_PER_SECOND', { infer: true }),
    );
  }

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

    await this.waitForTurn();

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

    if (response.status === 403) {
      throw new SourceBlockedError(`${source} was blocked by NHTSA (403)`, {
        source,
        status: response.status,
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
