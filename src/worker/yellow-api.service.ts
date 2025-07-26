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
      this.logger.error('Yellow API URL is not defined');

      return;
    }

    this.logger.log(`Connecting to Yellow API at ${this.WORKER_URL}...`);
    this.ws = new WebSocket(this.WORKER_URL);
    this.ws.on('open', () => this.logger.log('Successfully connected to Yellow API.'));
    this.ws.on('message', (data: WebSocket.Data) => this.handleMessage(String(data)));
    this.ws.on('error', (error) => this.logger.error(`WebSocket error: ${error.message}`));
    this.ws.on('close', () => this.handleDisconnection());
  }

  private handleDisconnection(): void {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 60000);

    this.logger.warn(`Connection closed. Reconnecting in ${delay / 1000}s...`);
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
        this.logger.warn('Received message without a valid method or request ID', rawData);

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
            // Fallback for methods you don't have a specific case for yet.
            this.logger.warn(`No specific parser case for method: ${method}.`);
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
          this.logger.error(
            `Could not find resolver for request ID ${requestId}, though it was expected.`,
          );
        }
      } else {
        // This is for broadcast/stream messages that we didn't explicitly request.
        this.logger.log(`Received unhandled message/stream update: ${method}`);
      }
    } catch (error) {
      this.logger.error('Failed to handle incoming message', {
        error: error instanceof Error ? error.message : String(error),
        rawData,
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

    // 2. **THE PATCH**: If pagination options are provided, inject them.
    if (paginationOptions) {
      this.logger.log(`Patching request with pagination: ${JSON.stringify(paginationOptions)}`);

      if (message.req[2] && typeof message.req[2][0] === 'object') {
        Object.assign(message.req[2][0], paginationOptions);
      }
    }

    const finalRequestJson = JSON.stringify(message);
    const requestId = message.req[0];

    this.logger.log(`Sending request ${finalRequestJson}`);
    const promise = new Promise<RPCResponse>((resolve, reject) => {
      this.pendingRequests.set(requestId, resolve);
      // Add a timeout to prevent requests from hanging forever
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error(`Request ${requestId} timed out after 30 seconds.`));
        }
      }, 60000);
    });

    this.ws.send(finalRequestJson);

    return promise;
  }
}
