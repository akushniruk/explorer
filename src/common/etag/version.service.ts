import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { createHash } from 'crypto';

@Injectable()
export class VersionService {
  private readonly logger = new Logger(VersionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Normalize query parameters to ensure stable hashing
   * - Sort object keys
   * - Sort array values
   * - Preserve types (numbers vs strings)
   */
  normalizeQuery(query: Record<string, unknown>): string {
    const normalize = (obj: unknown): unknown => {
      if (obj === null) {
        return null;
      }

      if (obj === undefined) {
        // JSON.stringify drops undefined fields. Converting to null keeps key presence stable.
        return null;
      }

      if (Array.isArray(obj)) {
        return obj.map(normalize).sort();
      }

      if (typeof obj === 'object') {
        const sorted: Record<string, unknown> = {};

        Object.keys(obj)
          .sort()
          .forEach((key) => {
            sorted[key] = normalize((obj as Record<string, unknown>)[key]);
          });

        return sorted;
      }

      return obj;
    };

    return JSON.stringify(normalize(query));
  }

  /**
   * Generate SHA-1 hash of input string
   */
  sha1(input: string): string {
    return createHash('sha1').update(input).digest('hex').substring(0, 16);
  }

  /**
   * Get version string for a resource based on DB state and query
   * Format: <resource>:<version>:<count>:<queryHash>
   */
  async getVersion(resource: string, query: Record<string, unknown>): Promise<string> {
    const normalizedQuery = this.normalizeQuery(query);
    const queryHash = this.sha1(normalizedQuery);

    let version: bigint;
    let count: bigint;

    try {
      const result = await this.getResourceMetadata(resource);

      version = result.v;
      count = result.c;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Unknown resource:')) {
        throw error;
      }
      this.logger.warn(`Failed to get version for resource ${resource}: ${error.message}`);
      // Fallback to current timestamp and 0 count
      version = BigInt(Math.floor(Date.now() / 1000));
      count = BigInt(0);
    }

    return `${resource}:${version}:${count}:${queryHash}`;
  }

  private async getResourceMetadata(resource: string): Promise<{ v: bigint; c: bigint }> {
    let tableName: string;

    switch (resource) {
      case 'nodes':
        tableName = 'nodes';
        break;
      case 'channels':
        tableName = 'channels';
        break;
      case 'assets':
        tableName = 'assets';
        break;
      case 'networks':
        tableName = 'networks';
        break;
      case 'app-sessions':
        tableName = 'app_sessions';
        break;
      default:
        throw new Error(`Unknown resource: ${resource}`);
    }

    const result = await this.prisma.$queryRawUnsafe<Array<{ v: bigint; c: bigint }>>(
      `SELECT
        COALESCE(MAX(EXTRACT(EPOCH FROM updated_at))::BIGINT, 0) AS v,
        COUNT(*)::BIGINT AS c
      FROM ${tableName}`,
    );

    if (!result || result.length === 0) {
      return { v: BigInt(0), c: BigInt(0) };
    }

    return result[0];
  }
}
