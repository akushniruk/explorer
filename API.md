# Nexus API Documentation

**Version:** v1  
**Base URL:** `/api/v1`

## Overview

Nexus is a blockchain payment channel explorer that provides REST APIs for querying channel data, assets, networks, app sessions, and nodes. The system synchronizes data from external Yellow API services and serves it through versioned endpoints.

## Authentication

Currently, no authentication is required for the public API endpoints.

## Rate Limiting

All endpoints implement throttling with the following default limits:
- Standard endpoints: 60 requests per minute
- Lightweight endpoints (count, list): 120 requests per minute

## Response Format

All API responses follow a standardized format:

### Success Response
```json
{
  "success": true,
  "data": <response_data>,
  "meta": {
    "timestamp": "2024-01-01T12:00:00.000Z",
    "requestId": "req_1704110400000_abc123",
    "version": "0.0.1",
    "pagination": {  // Only present for paginated responses
      "page": 1,
      "limit": 25,
      "total": 100,
      "totalPages": 4
    }
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "CHANNEL_NOT_FOUND",
    "message": "Channel not found",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "requestId": "req_1704110400000_abc123"
  }
}
```

## Common Query Parameters

### Pagination
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 25)

### Search
- `q`: Quick search across relevant fields

### Sorting
- `sortBy`: Field to sort by
- `order`: Sort order (`asc` or `desc`, default: `desc`)

## Endpoints

### Health Check

#### `GET /`
Returns a simple health check message.

**Response:**
```json
{
  "success": true,
  "data": "Hello World!",
  "meta": {
    "timestamp": "2024-01-01T12:00:00.000Z",
    "requestId": "req_1704110400000_abc123",
    "version": "0.0.1"
  }
}
```

### Channels

Channels represent payment channels on various blockchain networks.

#### `GET /api/v1/channel`
Get a single channel by ID.

**Query Parameters:**
- `channelId` (required): The unique channel identifier

**Rate Limit:** 60 requests per minute  
**Cache:** 5 seconds

**Response:**
```json
{
  "success": true,
  "data": {
    "channel_id": "0x123...",
    "chain_id": "1",
    "token": "0xtoken...",
    "wallet": "0xwallet...",
    "participant": "0xparticipant...",
    "amount": "1000000000000000000",
    "status": "open",
    "challenge": "0",
    "nonce": "5",
    "version": "1",
    "adjudicator": "0xadjudicator...",
    "created_at": "2024-01-01T12:00:00.000Z",
    "updated_at": "2024-01-01T12:30:00.000Z"
  }
}
```

#### `GET /api/v1/channel/:id`
Convenience endpoint to get a single channel by path parameter.

**Path Parameters:**
- `id`: The channel ID

**Rate Limit:** 60 requests per minute  
**Cache:** 5 seconds

#### `GET /api/v1/channel/list`
Get a paginated list of channels with optional filtering.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 25)
- `q` (optional): Search across channel_id, wallet, or participant
- `status` (optional): Filter by channel status
- `wallet` (optional): Filter by wallet address
- `participant` (optional): Filter by participant address
- `token` (optional): Filter by token address
- `chainId` (optional): Filter by chain ID
- `sortBy` (optional): Sort field (`updated_at`, `created_at`, `amount`) (default: `updated_at`)
- `order` (optional): Sort order (`asc`, `desc`) (default: `desc`)

**Rate Limit:** 60 requests per minute  
**Cache:** 5 seconds

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "channel_id": "0x123...",
      "chain_id": "1",
      // ... other channel fields
    }
  ],
  "meta": {
    "timestamp": "2024-01-01T12:00:00.000Z",
    "requestId": "req_1704110400000_abc123",
    "version": "0.0.1",
    "pagination": {
      "page": 1,
      "limit": 25,
      "total": 150,
      "totalPages": 6
    }
  }
}
```

#### `GET /api/v1/channel/count`
Get the total count of channels matching the filters.

**Query Parameters:**
- `status` (optional): Filter by channel status
- `token` (optional): Filter by token address
- `chainId` (optional): Filter by chain ID

**Rate Limit:** 120 requests per minute  
**Cache:** 15 seconds

**Response:**
```json
{
  "success": true,
  "data": {
    "count": 150
  }
}
```

### Assets

Assets represent tokens across different blockchain networks.

#### `GET /api/v1/asset`
Get a single asset by composite key (token address + chain ID).

**Query Parameters:**
- `token` (required): Token contract address
- `chainId` (required): Blockchain chain ID

**Rate Limit:** 120 requests per minute  
**Cache:** 30 seconds

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "0xtoken...",
    "chain_id": "1",
    "symbol": "ETH",
    "decimals": "18"
  }
}
```

#### `GET /api/v1/asset/list`
Get a paginated list of assets with optional filtering.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 25)
- `token` (optional): Filter by token address
- `chainId` (optional): Filter by chain ID
- `q` (optional): Search across token symbol

**Rate Limit:** 60 requests per minute  
**Cache:** 15 seconds

#### `GET /api/v1/asset/count`
Get the total count of assets matching the filters.

**Query Parameters:**
- `token` (optional): Filter by token address
- `chainId` (optional): Filter by chain ID
- `q` (optional): Search filter

**Rate Limit:** 120 requests per minute  
**Cache:** 30 seconds

### Networks

Networks represent supported blockchain networks.

#### `GET /api/v1/network`
Get a single network by query parameters.

**Query Parameters:**
- `chainId` (required): The blockchain chain ID

**Rate Limit:** 120 requests per minute  
**Cache:** 15 seconds

**Response:**
```json
{
  "success": true,
  "data": {
    "chain_id": "1",
    "name": "Ethereum Mainnet",
    "custody_address": "0xcustody...",
    "adjudicator_address": "0xadjudicator...",
    "broker_address": "0xbroker...",
    "last_seen_at": "2024-01-01T12:00:00.000Z",
    "updated_at": "2024-01-01T12:30:00.000Z"
  }
}
```

#### `GET /api/v1/network/:id`
Get a single network by path parameter.

**Path Parameters:**
- `id`: The chain ID

**Rate Limit:** 120 requests per minute  
**Cache:** 15 seconds

#### `GET /api/v1/network/list`
Get a paginated list of networks with optional filtering.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 25)
- `chainId` (optional): Filter by chain ID
- `q` (optional): Search across network name
- `broker` (optional): Filter by broker address

**Rate Limit:** 60 requests per minute  
**Cache:** 15 seconds

#### `GET /api/v1/network/count`
Get the total count of networks matching the filters.

**Query Parameters:**
- `chainId` (optional): Filter by chain ID
- `q` (optional): Search filter
- `broker` (optional): Filter by broker address

**Rate Limit:** 120 requests per minute  
**Cache:** 30 seconds

### App Sessions

App sessions represent application-level sessions within payment channels.

#### `GET /api/v1/app-session`
Get a single app session by query parameters.

**Query Parameters:**
- `sessionId` (required): The unique session identifier

**Rate Limit:** 120 requests per minute  
**Cache:** 15 seconds

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "protocol": "NitroRPC/0.2",
    "session_id": "session123",
    "channel_id": "0xchannel...",
    "nonce": "10",
    "participants": ["0xparticipant1...", "0xparticipant2..."],
    "weight": [50, 50],
    "quorum": "100",
    "version": "1",
    "status": "active",
    "challenge": "0",
    "session_data": "...",
    "created_at": "2024-01-01T12:00:00.000Z",
    "updated_at": "2024-01-01T12:30:00.000Z"
  }
}
```

#### `GET /api/v1/app-session/:id`
Get a single app session by path parameter.

**Path Parameters:**
- `id`: The session ID

**Rate Limit:** 120 requests per minute  
**Cache:** 15 seconds

#### `GET /api/v1/app-session/list`
Get a paginated list of app sessions with optional filtering.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 25)
- `status` (optional): Filter by session status
- `channelId` (optional): Filter by channel ID
- `participant` (optional): Filter by participant address
- `q` (optional): General search filter

**Rate Limit:** 60 requests per minute  
**Cache:** 15 seconds

#### `GET /api/v1/app-session/count`
Get the total count of app sessions matching the filters.

**Query Parameters:**
- `status` (optional): Filter by session status
- `channelId` (optional): Filter by channel ID
- `participant` (optional): Filter by participant address
- `q` (optional): Search filter

**Rate Limit:** 120 requests per minute  
**Cache:** 30 seconds

### Nodes

Nodes represent network infrastructure nodes with geographic information.

#### `GET /api/v1/nodes/list`
Get a paginated list of nodes suitable for map visualization.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 25)
- Additional filters as defined by `ListNodesQueryDto`

**Rate Limit:** 60 requests per minute  
**Cache:** 30 seconds

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "cuid123",
      "slug": "node-europe-1",
      "name": "Europe Node 1",
      "ws_url": "wss://node1.example.com",
      "description": "Primary European node",
      "website_host": "example.com",
      "icon_key": "example",
      "country_code": "DE",
      "region": "europe",
      "latitude": "52.520008",
      "longitude": "13.404954",
      "status": "online",
      "available": true,
      "latency_ms": 25,
      "last_seen_at": "2024-01-01T12:00:00.000Z",
      "created_at": "2024-01-01T10:00:00.000Z",
      "updated_at": "2024-01-01T12:00:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 25,
      "total": 50,
      "totalPages": 2
    }
  }
}
```

## Error Codes

The API uses standardized error codes for different types of failures:

### General Errors
- `INTERNAL_SERVER_ERROR`: Unexpected server error
- `VALIDATION_ERROR`: Request validation failed
- `NOT_FOUND`: Resource not found
- `BAD_REQUEST`: Invalid request format
- `TOO_MANY_REQUESTS`: Rate limit exceeded

### Business Logic Errors
- `CHANNEL_NOT_FOUND`: Requested channel does not exist
- `CHANNEL_ALREADY_CLOSED`: Operation not allowed on closed channel
- `INVALID_PARTICIPANT`: Invalid participant address
- `INVALID_TOKEN`: Invalid token address
- `UNSUPPORTED_CHAIN`: Chain ID not supported

### External Service Errors
- `YELLOW_API_CONNECTION_FAILED`: Could not connect to Yellow API
- `YELLOW_API_TIMEOUT`: Yellow API request timed out
- `DATABASE_CONNECTION_FAILED`: Database connection error

## Caching

Responses include appropriate cache headers:
- **Short-term (5s)**: Frequently changing data (channels, app sessions)
- **Medium-term (15s)**: Moderately changing data (networks, lists)
- **Long-term (30s)**: Stable data (assets, counts, nodes)

## WebSocket Integration

The system maintains real-time synchronization with external Yellow API services through WebSocket connections. This ensures data freshness while serving cached responses to API clients.

## Development

### Environment Variables
Key environment variables for API configuration:
- `PORT`: Server port (default: 3000)
- `DATABASE_URL`: PostgreSQL connection string
- `YELLOW_BASE_URL`: External Yellow API endpoint
- `REQUEST_TIMEOUT_MS`: API request timeout (default: 8000ms)

### Testing
```bash
# Run unit tests
npm test

# Run e2e tests
npm run test:e2e

# Run with coverage
npm run test:cov
```

### Building
```bash
# Build API application
npm run build:api

# Start in production
npm run start:prod
```