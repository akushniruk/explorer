import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as WebSocket from 'ws';
import {
  rpcResponseParser,
  RPCMethod,
  RPCResponse,
  MessageSigner,
  RequestData,
  ResponsePayload,
  createGetChannelsMessage,
  parseAnyRPCResponse,
  NitroliteRPCMessage,
  GetChannelsResponse,
} from '@erc7824/nitrolite';

// Moved mockSigner outside the class to be a reusable constant.
const mockSigner: MessageSigner = (
  _payload: RequestData | ResponsePayload,
): Promise<`0x${string}`> => {
  console.log('Using mock signer for payload:', _payload);
  return Promise.resolve('0x');
};
@Injectable()
export class WorkerService implements OnModuleInit {
  private readonly logger = new Logger(WorkerService.name);
  private readonly WORKER_URL = 'wss://clearnet.yellow.com/ws';
  private ws: WebSocket;
  private reconnectAttempts = 0;
  private pendingRequests = new Map<number, (response: RPCResponse) => void>();

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.logger.log(
      `WorkerService initialized. Starting connection to ${this.WORKER_URL}`,
    );
    this.connectToYellowNetwork();
  }

  private connectToYellowNetwork(): void {
    this.ws = new WebSocket(this.WORKER_URL);

    this.ws.on('open', () => {
      this.logger.log(`Connected to Yellow Network at ${this.WORKER_URL}`);
      this.reconnectAttempts = 0;

      // Fire-and-forget initial data requests
      void this.fetchAllChannels();
      // When you need more data, you can just add another call here:
      // this.sendRequest(createGetAssetsMessage);
    });

    // All messages are now handled by our central router
    this.ws.on('message', (data: WebSocket.Data) =>
      this.handleMessage(data.toString()),
    );

    this.ws.on('error', (error) =>
      this.logger.error(`WebSocket error: ${error.message}`),
    );

    this.ws.on('close', () => {
      this.logger.warn(`Connection to Yellow Network closed.`);
      this.handleDisconnection();
    });
  }

  private async fetchAllChannels(): Promise<void> {
    const limit = 100;
    let offset = 0; // Use offset instead of page
    const sort: 'asc' | 'desc' = 'desc'; // Add sort parameter
    let totalChannelsFetched = 0;
    const delayBetweenRequests = 5000; // 3 seconds delay

    this.logger.log(
      `Starting to fetch all channels with page size ${limit}...`,
    );

    try {
      while (true) {
        this.logger.log(
          `Fetching channels with limit ${limit} and offset ${offset}...`,
        );
        const options = { limit, offset, sort }; // Pass new options object

        const response = await this.sendRequest(
          (signer) => createGetChannelsMessage(signer),
          options,
        );

        const channelResponse = response as GetChannelsResponse;
        const channels = channelResponse.params;
        if (!channels || channels.length === 0) {
          this.logger.log(
            'Received an empty response, assuming all channels have been fetched.',
          );
          break;
        }

        this.processGetChannelsResponse(channelResponse);
        totalChannelsFetched += channels.length;

        if (channels.length < limit) {
          this.logger.log(
            'Received a partial response, assuming it is the last one.',
          );
          break;
        }

        offset += limit; // Increment offset for the next "page"

        this.logger.log(
          `Pausing for ${delayBetweenRequests / 1000} seconds before fetching next page...`,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, delayBetweenRequests),
        );
      }
    } catch (error) {
      this.logger.error(
        'An error occurred during paginated channel fetch',
        error,
      );
    }

    this.logger.log(
      `Finished fetching. Total channels processed: ${totalChannelsFetched}`,
    );
  }

  /**
   * Sends a request, optionally patching it with pagination options, and
   * returns a Promise that resolves with the corresponding response.
   */
  private async sendRequest(
    createMessageFn: (signer: MessageSigner) => Promise<string>,
    paginationOptions?: { limit: number; offset: number; sort: 'asc' | 'desc' },
  ): Promise<RPCResponse> {
    // 1. Generate the base request from the SDK
    const baseRequestJson = await createMessageFn(mockSigner);
    const message = JSON.parse(baseRequestJson) as NitroliteRPCMessage;

    if (!message || !message.req) {
      throw new Error('Invalid message format received from SDK');
    }

    // 2. **THE PATCH**: If pagination options are provided, inject them.
    if (paginationOptions) {
      this.logger.log(
        `Patching request with pagination: ${JSON.stringify(paginationOptions)}`,
      );
      if (message.req[2] && typeof message.req[2][0] === 'object') {
        Object.assign(message.req[2][0], paginationOptions);
      }
    }

    // 3. Prepare to send the (potentially modified) message
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
      }, 30000);
    });

    this.ws.send(finalRequestJson);
    return promise;
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
        this.logger.warn(
          'Received message without a valid method or request ID',
          rawData,
        );
        return;
      }

      // 2. Check if this is a response to a request we are waiting for.
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

        // 4. Resolve the promise with the fully typed response.

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
        error,
        rawData,
      });
    }
  }

  /**
   * Processes a page of channels from a get_channels response.
   */
  private processGetChannelsResponse(response: GetChannelsResponse): void {
    // The response object is already parsed and typed by rpcResponseParser.
    const channels = response.params;
    this.logger.log(`Processing ${channels.length} channels from page...`);

    for (const channel of channels) {
      // The 'channel' object fields are already camelCased and correctly typed.
      const dataToUpsert = {
        channel_id: channel.channelId,
        participant: channel.participant,
        status: channel.status,
        token: channel.token,
        wallet: channel.wallet,
        amount: channel.amount,
        chain_id: BigInt(channel.chainId),
        adjudicator: channel.adjudicator,
        challenge: BigInt(channel.challenge),
        nonce: channel.nonce,
        version: BigInt(channel.version),
      };

      this.logger.log(`Upserting channel: ${dataToUpsert.channel_id}`);
      // Your database logic would go here.
      // await this.prisma.channel.upsert({ ... });
    }
  }
  private handleDisconnection(): void {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 60000);
    this.logger.log(`Attempting to reconnect in ${delay / 1000} seconds...`);
    setTimeout(() => this.connectToYellowNetwork(), delay);
  }
}
