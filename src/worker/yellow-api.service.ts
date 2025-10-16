// src/worker/yellow-api.service.ts
import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import * as WebSocket from 'ws';
import {
  RPCMethod,
  RPCResponse,
  MessageSigner,
  NitroliteRPCMessage,
  GetChannelsResponse,
  GetConfigResponse,
  GetAssetsResponse,
  GetAppSessionsResponse,
  RPCChannelStatus,
  createGetChannelsMessage,
  createGetConfigMessage,
  createGetAssetsMessage,
  createGetAppSessionsMessage,
  createPingMessage,
  parseAnyRPCResponse,
} from '@erc7824/nitrolite';
import workerCfg from './worker.config';
import { ConfigType } from '@nestjs/config';

const mockSigner: MessageSigner = () => Promise.resolve('0x');

type PendingEntry = {
  expected: Set<RPCMethod>;
  resolve: (resp: RPCResponse) => void;
  reject: (err: Error) => void;
  timeout: NodeJS.Timeout;
};

@Injectable()
export class YellowApiService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(YellowApiService.name);
  private ws!: WebSocket;
  private reconnectAttempts = 0;
  private pendingRequests = new Map<number, PendingEntry>();

  constructor(@Inject(workerCfg.KEY) private readonly cfg: ConfigType<typeof workerCfg>) {}

  /* -------------------------- lifecycle -------------------------- */

  onModuleInit() {
    this.connect();
  }

  onModuleDestroy() {
    try {
      this.rejectAllPending(new Error('WS_SHUTTING_DOWN'));

      if (this.ws) {
        try {
          this.ws.removeAllListeners();
          this.ws.terminate();
        } catch {
          /* noop */
        }
      }
    } catch {
      /* noop */
    }
  }

  /* -------------------------- public RPCs ------------------------ */

  public async getConfig(): Promise<GetConfigResponse> {
    return (await this.sendRequest<RPCMethod.GetConfig>(
      (s) => createGetConfigMessage(s),
      RPCMethod.GetConfig,
    )) as GetConfigResponse;
  }

  public async getChannels(
    options: {
      participant?: `0x${string}`;
      status?: RPCChannelStatus;
      offset?: number;
      limit?: number;
      sort?: 'asc' | 'desc';
    } = {},
  ): Promise<GetChannelsResponse> {
    const baseJson = await createGetChannelsMessage(mockSigner);
    const msg = JSON.parse(baseJson) as NitroliteRPCMessage;

    // Patch the message to include all the options - always set offset and limit explicitly
    if (msg?.req?.[2] && typeof msg.req[2] === 'object') {
      const params = msg.req[2] as any;

      if (options.participant !== undefined) {
        params.participant = options.participant;
      }

      if (options.status !== undefined) {
        params.status = options.status;
      }

      // Always set offset and limit explicitly
      params.offset = options.offset ?? 0;
      params.limit = options.limit ?? 100;

      if (options.sort !== undefined) {
        params.sort = options.sort;
      }
    }

    const finalJson = JSON.stringify(msg);

    return (await this.sendRequest<RPCMethod.GetChannels>(
      () => Promise.resolve(finalJson),
      RPCMethod.GetChannels,
    )) as GetChannelsResponse;
  }

  public async getAssets(chainId?: number): Promise<GetAssetsResponse> {
    return (await this.sendRequest<RPCMethod.GetAssets>(
      (s) => createGetAssetsMessage(s, chainId),
      RPCMethod.GetAssets,
    )) as GetAssetsResponse;
  }

  /**
   * Fetch app sessions. The SDK helper requires a participant Address, but the
   * backend allows empty participant ('') to mean "all sessions". We build the
   * message with a placeholder and patch the payload to allow '' plus pagination.
   */
  public async getAppSessions(
    opts: {
      participant?: `0x${string}` | ''; // '' => all sessions
      status?: RPCChannelStatus;
      offset?: number;
      limit?: number;
      sort?: 'asc' | 'desc';
    } = {},
  ): Promise<GetAppSessionsResponse> {
    const placeholder: `0x${string}` = '0x0000000000000000000000000000000000000000';

    const baseJson = await createGetAppSessionsMessage(mockSigner, placeholder, opts?.status);

    const msg = JSON.parse(baseJson) as NitroliteRPCMessage;

    if (msg?.req?.[2] && typeof msg.req[2] === 'object') {
      const params = msg.req[2] as any;

      // Set participant - allow empty string for "all sessions"
      params.participant = opts?.participant ?? '';

      if (opts?.status !== undefined) {
        params.status = opts.status;
      }

      // Always set offset and limit explicitly
      params.offset = opts?.offset ?? 0;
      params.limit = opts?.limit ?? 1000;

      if (opts?.sort !== undefined) {
        params.sort = opts.sort;
      }
    }

    const finalJson = JSON.stringify(msg);

    return (await this.sendRequest<RPCMethod.GetAppSessions>(
      () => Promise.resolve(finalJson),
      RPCMethod.GetAppSessions,
    )) as GetAppSessionsResponse;
  }

  /** Ping expects a "pong" response from the server. */
  public async ping(): Promise<void> {
    await this.sendRequest<RPCMethod.Pong>((s) => createPingMessage(s), RPCMethod.Pong);
  }

  /** Block until WS is OPEN or timeout. */
  public async waitUntilOpen(timeoutMs = 5_000): Promise<void> {
    if (this.isOpen()) return;

    await new Promise<void>((resolve, reject) => {
      const start = Date.now();
      const tid = setInterval(() => {
        if (this.isOpen()) {
          clearInterval(tid);
          resolve();
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(tid);
          reject(new Error('WS_NOT_CONNECTED'));
        }
      }, 50);
    });
  }

  /* -------------------------- connection ------------------------ */

  private connect(): void {
    if (!this.cfg.wsUrl) {
      this.logger.error('Yellow API configuration missing', {
        component: 'YellowApiService',
        error: 'YELLOW_API_URL not defined',
        action: 'connection_failed',
      });

      return;
    }

    this.logger.log('Initiating Yellow API WebSocket connection', {
      component: 'YellowApiService',
      url: this.cfg.wsUrl,
      protocol: 'ws',
    });

    this.ws = new WebSocket(this.cfg.wsUrl);

    this.ws.on('open', () => {
      this.reconnectAttempts = 0;
      this.logger.log('WebSocket connection established', {
        component: 'YellowApiService',
        url: this.cfg.wsUrl,
        status: 'connected',
      });
    });

    this.ws.on('message', (data: WebSocket.Data) => this.handleMessage(String(data)));

    this.ws.on('error', (error) =>
      this.logger.error('WebSocket connection error', {
        component: 'YellowApiService',
        error: error.message,
        url: this.cfg.wsUrl,
      }),
    );

    this.ws.on('close', () => this.handleDisconnection());
  }

  private handleDisconnection(): void {
    const base = Number(this.cfg.wsReconnectBaseMs ?? 1_000);
    const max = Number(this.cfg.wsReconnectMaxMs ?? 60_000);

    this.reconnectAttempts++;
    const delay = Math.min(base * 2 ** this.reconnectAttempts, max);

    this.logger.warn('WebSocket connection lost, initiating reconnection', {
      component: 'YellowApiService',
      reconnectAttempt: this.reconnectAttempts,
      nextRetryInMs: delay,
      pendingRequests: this.pendingRequests.size,
    });

    this.rejectAllPending(new Error('WS_DISCONNECTED'));
    setTimeout(() => this.connect(), delay);
  }

  /* -------------------------- message routing ------------------- */

  private handleMessage(rawData: string): void {
    try {
      const { method, requestId } = this.loosePeek(rawData);

      if (requestId === undefined || !method) {
        this.logger.warn('Invalid message received from Yellow API', {
          component: 'YellowApiService',
          issue: 'Missing method or request ID',
          messageLength: rawData.length,
        });

        return;
      }

      // Broadcasts (no pending resolver)
      if (!this.pendingRequests.has(requestId)) {
        this.logger.debug('Received broadcast message from Yellow API', {
          component: 'YellowApiService',
          method,
          type: 'stream_update',
          requestId,
        });

        return;
      }

      let response: RPCResponse;

      // Use generic parser for all responses, fall back to loose response if needed
      try {
        response = parseAnyRPCResponse(rawData);
      } catch (err) {
        // Generic parser failed (likely due to schema validation like unknown enum values)
        // Use loose response without strict validation
        const errorMsg = (err as Error)?.message ?? String(err);

        // Only log as debug for known enum validation issues, warn for others
        if (errorMsg.includes('Invalid enum value') || errorMsg.includes('invalid_enum_value')) {
          this.logger.debug(
            'Response contains values outside expected enum (using loose parsing)',
            {
              component: 'YellowApiService',
              method,
              requestId,
              note: 'This is expected when API returns new enum values before SDK update',
            },
          );
        } else {
          this.logger.warn('Response parsing failed; using loose response', {
            component: 'YellowApiService',
            method,
            error: errorMsg.substring(0, 500), // Truncate long errors
            requestId,
          });
        }

        response = this.makeLooseResponse(method, rawData, requestId);
      }

      const entry = this.pendingRequests.get(requestId);

      if (!entry) {
        // Rare race: resolver removed; drop
        this.logger.warn('Received response with no pending resolver', {
          component: 'YellowApiService',
          requestId,
          method,
        });

        return;
      }

      clearTimeout(entry.timeout);

      if (!entry.expected.has(response.method)) {
        this.logger.warn('RPC method mismatch on response', {
          requestId,
          expected: [...entry.expected],
          got: response.method,
          ...(response.method === 'error' && { errorDetails: response.params }),
        });
      }

      entry.resolve(response);
      this.pendingRequests.delete(requestId);
    } catch (error) {
      this.logger.error('Message processing failed', {
        component: 'YellowApiService',
        error: (error as Error)?.message ?? String(error),
        messageLength: rawData.length,
        operation: 'handle_message',
      });
    }
  }

  /* -------------------------- request sender -------------------- */

  private async sendRequest<TM extends RPCMethod>(
    createMessageFn: (signer: MessageSigner) => Promise<string>,
    expectedMethod: TM,
  ): Promise<RPCResponse> {
    // ensure socket is open (configurable wait)
    await this.waitUntilOpen(this.cfg.wsRequestTimeoutMs ?? 5_000);

    const finalRequestJson = await createMessageFn(mockSigner);
    const message = JSON.parse(finalRequestJson) as NitroliteRPCMessage;

    if (!message?.req) {
      throw new Error('Invalid message format received from SDK');
    }

    const requestId = message.req[0];

    this.logger.debug('Sending RPC request to Yellow API', {
      component: 'YellowApiService',
      requestId,
      messageSize: finalRequestJson.length,
      method: expectedMethod,
    });

    const promise = new Promise<RPCResponse>((resolve, reject) => {
      const timeoutMs = Number(this.cfg.wsRequestTimeoutMs ?? 90_000);

      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          this.logger.error('RPC request timeout', {
            component: 'YellowApiService',
            requestId,
            timeoutMs,
            operation: 'send_request',
          });
          reject(new Error(`Request ${requestId} timed out after ${timeoutMs} ms.`));
        }
      }, timeoutMs);

      this.pendingRequests.set(requestId, {
        expected: new Set([expectedMethod]),
        resolve,
        reject,
        timeout,
      });
    });

    this.ws.send(finalRequestJson);

    return promise;
  }

  /* -------------------------- helpers --------------------------- */

  private loosePeek(raw: string): { method?: RPCMethod; requestId?: number } {
    try {
      const obj = JSON.parse(raw);

      // Expected envelope: { res: [requestId, method, params, timestamp], sig: [...] }
      if (obj && Array.isArray(obj.res) && obj.res.length >= 2) {
        const [id, method] = obj.res;
        const rid = typeof id === 'number' ? id : Number(id);

        return { requestId: Number.isFinite(rid) ? rid : undefined, method: method as RPCMethod };
      }
    } catch {
      // ignore
    }

    return { method: undefined, requestId: undefined };
  }

  /**
   * Build a "loose" response for a known method without zod validation.
   * Uses a generic to satisfy the discriminated union of RPCResponse.
   * This allows handling of responses with non-standard enum values (e.g., "joining" status).
   */
  private makeLooseResponse<M extends RPCMethod>(
    method: M,
    raw: string,
    requestId: number,
  ): Extract<RPCResponse, { method: M }> {
    let params: unknown;

    try {
      const obj = JSON.parse(raw);
      let p = Array.isArray(obj.res) ? obj.res[2] : undefined;

      // Handle GetChannels responses with non-standard enum values
      if (method === RPCMethod.GetChannels && p && typeof p === 'object' && 'channels' in p) {
        // Pass through channels array as-is without enum validation
        // This allows statuses like "joining" that aren't in the SDK's enum yet
        params = p;
      }
      // In v0.3.0, responses should have proper structure, but handle legacy format
      else if (method === RPCMethod.GetAppSessions) {
        if (Array.isArray(p) && Array.isArray(p[0])) {
          // Legacy format: [[ {...}, ... ]]
          p = { appSessions: p[0] };
        } else if (
          Array.isArray(p) &&
          !('appSessions' in (p as any)) &&
          !('app_sessions' in (p as any))
        ) {
          // Direct array format: [ {...}, ... ]
          p = { appSessions: p };
        } else if (p && typeof p === 'object') {
          // Handle both camelCase and snake_case
          if ('appSessions' in p) {
            // Already correct format
            // Keep as is
          } else if ('app_sessions' in p) {
            // Convert snake_case to camelCase
            p = { appSessions: p.app_sessions };
          } else {
            // Try to find appSessions data elsewhere in the response
            this.logger.warn('Could not find app sessions in expected location', {
              responseKeys: Object.keys(obj),
              res2Keys: Object.keys(p),
            });
            p = { appSessions: [] };
          }
        } else {
          // Not an object, set empty
          p = { appSessions: [] };
        }

        params = p;
      } else {
        // Default: pass through params as-is
        params = p;
      }
    } catch {
      params = undefined;
    }

    return { method, requestId, params } as unknown as Extract<RPCResponse, { method: M }>;
  }

  private isOpen(): boolean {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  private rejectAllPending(err: Error) {
    for (const [id, entry] of this.pendingRequests.entries()) {
      try {
        clearTimeout(entry.timeout);
        entry.reject(err);
      } catch {
        /* noop */
      } finally {
        this.pendingRequests.delete(id);
      }
    }
  }
}
