import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject } from '@nestjs/common';
import * as WebSocket from 'ws';
import {
  RPCMethod,
  RPCResponse,
  MessageSigner,
  createGetChannelsMessage,
  createGetConfigMessage,
  NitroliteRPCMessage,
  GetChannelsResponse,
  GetConfigResponse,
  rpcResponseParser,
  parseAnyRPCResponse,
} from '@erc7824/nitrolite';
import workerCfg from './worker.config';
import { ConfigType } from '@nestjs/config';

const mockSigner: MessageSigner = () => Promise.resolve('0x');

type PaginationOptions = { limit: number; offset: number; sort: 'asc' | 'desc' };
type ExtractByMethod<TMethod extends RPCMethod> = Extract<RPCResponse, { method: TMethod }>;

class Deferred<T> {
  promise: Promise<T>;
  resolve!: (v: T) => void;
  reject!: (e: any) => void;
  constructor() {
    this.promise = new Promise<T>((res, rej) => {
      this.resolve = res;
      this.reject = rej;
    });
  }
}

@Injectable()
export class YellowApiService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(YellowApiService.name);
  private ws!: WebSocket;
  private reconnectAttempts = 0;

  private pendingRequests = new Map<
    number,
    {
      expected: RPCMethod;
      resolve: (r: RPCResponse) => void;
      reject: (e: Error) => void;
      timer: NodeJS.Timeout;
    }
  >();

  private openAwaiter: Deferred<void> | null = null;

  constructor(@Inject(workerCfg.KEY) private readonly cfg: ConfigType<typeof workerCfg>) {}

  onModuleInit() {
    this.connect();
  }

  onModuleDestroy() {
    try {
      for (const [id, p] of this.pendingRequests.entries()) {
        clearTimeout(p.timer);
        p.reject(new Error('WS_CLOSED'));
        this.pendingRequests.delete(id);
      }

      this.ws?.close();
    } catch {
      /* noop */
    }
  }

  /** Wait until the WebSocket is OPEN (or timeout). */
  public async waitUntilOpen(timeoutMs = 5_000): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    const waiter = this.openAwaiter?.promise ?? Promise.resolve();

    await Promise.race([
      waiter,
      new Promise<void>((_, rej) =>
        setTimeout(() => rej(new Error('WS_CONNECT_TIMEOUT')), timeoutMs),
      ),
    ]);
  }

  // ---------- Public RPCs ----------

  public async getConfig(): Promise<GetConfigResponse> {
    return this.sendRequest<RPCMethod.GetConfig>(
      (s) => createGetConfigMessage(s),
      RPCMethod.GetConfig,
    );
  }

  public async getChannels(options: PaginationOptions): Promise<GetChannelsResponse> {
    return this.sendRequest<RPCMethod.GetChannels>(
      (s) => createGetChannelsMessage(s),
      RPCMethod.GetChannels,
      options,
    );
  }

  // ---------- Internals ----------

  private resetOpenAwaiter() {
    this.openAwaiter = new Deferred<void>();
  }

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

    this.resetOpenAwaiter();
    this.ws = new WebSocket(this.cfg.wsUrl);

    this.ws.on('open', () => {
      this.reconnectAttempts = 0;
      this.openAwaiter?.resolve();
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
    // reject all pending
    for (const [id, p] of this.pendingRequests.entries()) {
      clearTimeout(p.timer);
      p.reject(new Error('WS_DISCONNECTED'));
      this.pendingRequests.delete(id);
    }

    // prepare a new awaiter for the next connect cycle
    this.resetOpenAwaiter();

    this.reconnectAttempts++;
    const base = this.cfg.wsReconnectBaseMs;
    const max = this.cfg.wsReconnectMaxMs;
    const delay = Math.min(base * 2 ** this.reconnectAttempts, max);

    this.logger.warn('WebSocket connection lost, initiating reconnection', {
      component: 'YellowApiService',
      reconnectAttempt: this.reconnectAttempts,
      nextRetryInMs: delay,
      pendingRequests: 0,
    });

    setTimeout(() => this.connect(), delay);
  }

  private handleMessage(rawData: string): void {
    try {
      const anyResp = parseAnyRPCResponse(rawData);
      const { method, requestId } = anyResp;

      if (!method || requestId === undefined) {
        this.logger.warn('Invalid message received from Yellow API', {
          component: 'YellowApiService',
          issue: 'Missing method or request ID',
          messageLength: rawData.length,
        });

        return;
      }

      const pending = this.pendingRequests.get(requestId);

      if (!pending) {
        this.logger.debug('Received broadcast message from Yellow API', {
          component: 'YellowApiService',
          method,
          type: 'stream_update',
          requestId,
        });

        return;
      }

      let response: RPCResponse;

      switch (method) {
        case RPCMethod.GetChannels:
          response = rpcResponseParser.getChannels(rawData);
          break;
        case RPCMethod.GetConfig:
          response = rpcResponseParser.getConfig(rawData);
          break;
        default:
          this.logger.warn('Unhandled RPC method received', {
            component: 'YellowApiService',
            method,
            requestId,
            fallbackParser: 'parseAnyRPCResponse',
          });
          response = anyResp;
          break;
      }

      if (pending.expected !== response.method) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(requestId);
        pending.reject(
          new Error(
            `RPC method mismatch for request ${requestId}: expected ${pending.expected}, got ${response.method}`,
          ),
        );

        return;
      }

      clearTimeout(pending.timer);
      this.pendingRequests.delete(requestId);
      pending.resolve(response);
    } catch (error) {
      this.logger.error('Message processing failed', {
        component: 'YellowApiService',
        error: error instanceof Error ? error.message : String(error),
        messageLength: rawData.length,
        operation: 'handle_message',
      });
    }
  }

  private async sendRequest<TMethod extends RPCMethod>(
    createMessageFn: (signer: MessageSigner) => Promise<string>,
    expectedMethod: TMethod,
    paginationOptions?: PaginationOptions,
  ): Promise<ExtractByMethod<TMethod>> {
    // wait for WS to be OPEN to avoid WS_NOT_CONNECTED races
    await this.waitUntilOpen(this.cfg.wsRequestTimeoutMs ?? 5_000);

    const baseRequestJson = await createMessageFn(mockSigner);
    const message = JSON.parse(baseRequestJson) as NitroliteRPCMessage;

    if (!message?.req) throw new Error('Invalid message format received from SDK');

    if (paginationOptions && message.req[2] && typeof message.req[2][0] === 'object') {
      this.logger.debug('Applying pagination to RPC request', {
        component: 'YellowApiService',
        requestId: message.req[0],
        pagination: paginationOptions,
      });
      Object.assign(message.req[2][0], paginationOptions);
    }

    const finalRequestJson = JSON.stringify(message);
    const requestId = message.req[0];

    this.logger.debug('Sending RPC request to Yellow API', {
      component: 'YellowApiService',
      requestId,
      messageSize: finalRequestJson.length,
    });

    const promise = new Promise<ExtractByMethod<TMethod>>((resolve, reject) => {
      const timer = setTimeout(() => {
        const pending = this.pendingRequests.get(requestId);

        if (pending) {
          this.pendingRequests.delete(requestId);
          this.logger.error('RPC request timeout', {
            component: 'YellowApiService',
            requestId,
            timeoutMs: this.cfg.wsRequestTimeoutMs,
            operation: 'send_request',
          });
          reject(
            new Error(`Request ${requestId} timed out after ${this.cfg.wsRequestTimeoutMs} ms.`),
          );
        }
      }, this.cfg.wsRequestTimeoutMs);

      this.pendingRequests.set(requestId, {
        expected: expectedMethod,
        resolve: (r) => resolve(r as ExtractByMethod<TMethod>),
        reject,
        timer,
      });
    });

    this.ws.send(finalRequestJson);

    return promise;
  }
}
