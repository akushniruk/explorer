import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as WebSocket from 'ws';
import {
  RPCMethod,
  RPCResponse,
  MessageSigner,
  createGetChannelsMessage,
  NitroliteRPCMessage,
  GetChannelsResponse,
  rpcResponseParser,
  parseAnyRPCResponse,
} from '@erc7824/nitrolite';

const mockSigner: MessageSigner = () => Promise.resolve('0x');

type PaginationOptions = {
  limit: number;
  offset: number;
  sort: 'asc' | 'desc';
};

@Injectable()
export class YellowApiService implements OnModuleInit {
  private readonly logger = new Logger(YellowApiService.name);
  private readonly WORKER_URL = process.env.YELLOW_API_URL;
  private ws: WebSocket;
  private reconnectAttempts = 0;
  private pendingRequests = new Map<number, (response: RPCResponse) => void>();

  onModuleInit() {
    this.connect();
  }

  public async getChannels(options: PaginationOptions): Promise<GetChannelsResponse> {
    const response = await this.sendRequest((signer) => createGetChannelsMessage(signer), options);

    return response as GetChannelsResponse;
  }

  private connect(): void {
    if (!this.WORKER_URL) {
      this.logger.error('Yellow API configuration missing', {
        component: 'YellowApiService',
        error: 'YELLOW_API_URL environment variable not defined',
        action: 'connection_failed',
      });

      return;
    }

    this.logger.log('Initiating Yellow API WebSocket connection', {
      component: 'YellowApiService',
      url: this.WORKER_URL,
      protocol: 'ws',
    });
    this.ws = new WebSocket(this.WORKER_URL);
    this.ws.on('open', () =>
      this.logger.log('WebSocket connection established', {
        component: 'YellowApiService',
        url: this.WORKER_URL,
        status: 'connected',
      }),
    );
    this.ws.on('message', (data: WebSocket.Data) => this.handleMessage(String(data)));
    this.ws.on('error', (error) =>
      this.logger.error('WebSocket connection error', {
        component: 'YellowApiService',
        error: error.message,
        url: this.WORKER_URL,
      }),
    );
    this.ws.on('close', () => this.handleDisconnection());
  }

  private handleDisconnection(): void {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 60000);

    this.logger.warn('WebSocket connection lost, initiating reconnection', {
      component: 'YellowApiService',
      reconnectAttempt: this.reconnectAttempts,
      nextRetryIn: `${delay / 1000}s`,
      pendingRequests: this.pendingRequests.size,
    });
    this.pendingRequests.clear();
    setTimeout(() => this.connect(), delay);
  }

  /**
   * The central message router. It uses rpcResponseParser to get fully
   * typed response objects before resolving pending requests.
   */
  private handleMessage(rawData: string): void {
    try {
      const response = parseAnyRPCResponse(rawData);
      const method = response.method;
      const requestId = response.requestId;

      if (!method || requestId === undefined) {
        this.logger.warn('Invalid message received from Yellow API', {
          component: 'YellowApiService',
          issue: 'Missing method or request ID',
          messageLength: rawData.length,
        });

        return;
      }

      if (this.pendingRequests.has(requestId)) {
        let response: RPCResponse;

        // 3. Use the specific parser from rpcResponseParser based on the method.
        switch (method) {
          case RPCMethod.GetChannels: {
            response = rpcResponseParser.getChannels(rawData);
            break;
          }
          // As you add more requests, you can add their parsers here.
          // case RPCMethod.GetAssets: {
          //   response = rpcResponseParser.getAssets(rawData);
          //   break;
          // }
          default:
            this.logger.warn('Unhandled RPC method received', {
              component: 'YellowApiService',
              method: method,
              requestId: requestId,
              fallbackParser: 'parseAnyRPCResponse',
            });
            response = parseAnyRPCResponse(rawData);
            break;
        }

        if (!response) {
          throw new Error(
            `Failed to parse response for method ${method} with request ID ${requestId}`,
          );
        }

        const resolver = this.pendingRequests.get(requestId);

        if (resolver) {
          resolver(response);
          this.pendingRequests.delete(requestId);
        } else {
          this.logger.error('Request resolver not found', {
            component: 'YellowApiService',
            requestId: requestId,
            method: method,
            issue: 'Missing resolver for expected request',
          });
        }
      } else {
        this.logger.debug('Received broadcast message from Yellow API', {
          component: 'YellowApiService',
          method: method,
          type: 'stream_update',
          requestId: requestId,
        });
      }
    } catch (error) {
      this.logger.error('Message processing failed', {
        component: 'YellowApiService',
        error: error instanceof Error ? error.message : String(error),
        messageLength: rawData.length,
        operation: 'handle_message',
      });
    }
  }

  /**
   * Sends a request, optionally patching it with pagination options, and
   * returns a Promise that resolves with the corresponding response.
   */
  private async sendRequest(
    createMessageFn: (signer: MessageSigner) => Promise<string>,
    paginationOptions?: { limit: number; offset: number; sort: 'asc' | 'desc' },
  ): Promise<RPCResponse> {
    const baseRequestJson = await createMessageFn(mockSigner);
    const message = JSON.parse(baseRequestJson) as NitroliteRPCMessage;

    if (!message || !message.req) {
      throw new Error('Invalid message format received from SDK');
    }

    if (paginationOptions) {
      this.logger.debug('Applying pagination to RPC request', {
        component: 'YellowApiService',
        requestId: message.req[0],
        pagination: paginationOptions,
      });

      if (message.req[2] && typeof message.req[2][0] === 'object') {
        Object.assign(message.req[2][0], paginationOptions);
      }
    }

    const finalRequestJson = JSON.stringify(message);
    const requestId = message.req[0];

    this.logger.debug('Sending RPC request to Yellow API', {
      component: 'YellowApiService',
      requestId: requestId,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      method: (message as any).method || 'unknown',
      messageSize: finalRequestJson.length,
    });
    const promise = new Promise<RPCResponse>((resolve, reject) => {
      this.pendingRequests.set(requestId, resolve);
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          this.logger.error('RPC request timeout', {
            component: 'YellowApiService',
            requestId: requestId,
            timeout: '90s',
            operation: 'send_request',
          });
          reject(new Error(`Request ${requestId} timed out after 90 seconds.`));
        }
      }, 90000);
    });

    this.ws.send(finalRequestJson);

    return promise;
  }
}
