# Nexus - Payment Channel Explorer

A comprehensive blockchain payment channel explorer built with NestJS, featuring real-time synchronization and REST APIs for querying channel data across multiple networks.

## Overview

Nexus implements a dual-application architecture with an API server and background worker service:

- **API Application**: REST endpoints for frontend consumption at `/api/v1/*`
- **Worker Application**: Background synchronization with external Yellow API services
- **Multi-chain Support**: Tracks channels, assets, and networks across different blockchains
- **Real-time Updates**: WebSocket integration for live data synchronization

## Features

- 🌐 **Multi-chain Payment Channel Explorer**
- 📊 **Real-time Data Synchronization** via WebSocket connections
- 🚀 **High-performance REST APIs** with caching and rate limiting  
- 📄 **Standardized Response Format** with pagination and metadata
- 🔍 **Advanced Filtering & Search** across all entities
- 🗄️ **PostgreSQL Database** with Prisma ORM
- 🧪 **Comprehensive Test Coverage** with Jest
- 📈 **Performance Monitoring** and error tracking
- 🛡️ **Security Features** with Helmet and validation

## Architecture

### Core Components

```
src/
├── api/           # External API client integrations (Yellow API)
├── worker/        # Background sync services with cursor-based pagination
├── explorer/      # Business domain modules (Channels, Assets, Networks, etc.)
├── common/        # Shared utilities, response interceptors, exception filters
├── config/        # Environment configuration and validation
└── prisma/        # Database service layer
```

### Database Schema

- **Channel**: Payment channels with participant and token information
- **Asset**: Token definitions across different chains  
- **Network**: Supported blockchain networks with contract addresses
- **AppSession**: Application-level sessions within channels
- **Node**: Network infrastructure nodes with geographic data
- **WorkerState**: Synchronization cursor tracking for resumable sync

## Quick Start

### Prerequisites

- Node.js 18+ 
- PostgreSQL 12+
- pnpm (recommended) or npm

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd nexus

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Set up database
npx prisma migrate deploy
npx prisma generate

# Optional: Seed database
npm run prisma:seed
```

### Development

```bash
# Start API server in development mode
npm run start:dev

# Start worker in development mode (separate terminal)
npm run start:worker:dev

# Run tests
npm test
npm run test:e2e
npm run test:cov

# Lint code
npm run lint
npm run lint:fix
```

### Production

```bash
# Build applications
npm run build

# Start API server
npm run start:prod

# Start worker (separate process)
npm run start:worker
```

## API Documentation

The API provides RESTful endpoints for querying blockchain payment channel data. All responses follow a standardized format with proper error handling and pagination.

**Base URL**: `/api/v1`

### Main Endpoints

- `GET /channel` - Retrieve channel data
- `GET /channel/list` - List channels with pagination and filtering  
- `GET /asset` - Get asset information
- `GET /network` - Network details and configurations
- `GET /app-session` - Application session data
- `GET /nodes/list` - Network nodes for map visualization

### Response Format

```json
{
  "success": true,
  "data": "<response_data>",
  "meta": {
    "timestamp": "2024-01-01T12:00:00.000Z",
    "requestId": "req_1704110400000_abc123",
    "version": "0.0.1",
    "pagination": {
      "page": 1,
      "limit": 25,
      "total": 100,
      "totalPages": 4
    }
  }
}
```

For detailed API documentation, see [API.md](./API.md).

## Configuration

### Environment Variables

Key configuration options:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/nexus
DIRECT_URL=postgresql://user:password@localhost:5432/nexus

# Server
PORT=3000

# External APIs
YELLOW_BASE_URL=wss://api.yellow.org
REQUEST_TIMEOUT_MS=8000

# Worker Configuration
SYNC_CHANNELS_INTERVAL_MINUTES=5
SYNC_ASSETS_INTERVAL_MINUTES=60
SYNC_NETWORKS_INTERVAL_MINUTES=30
```

For complete configuration schema, see `src/config/env.validation.ts`.

## Development Guide

### Project Structure

```
nexus/
├── src/
│   ├── main.ts              # API application entry point
│   ├── worker.ts            # Worker application entry point
│   ├── app.module.ts        # Main application module
│   ├── explorer/            # Business logic modules
│   │   ├── channel/         # Channel-related endpoints and services
│   │   ├── asset/           # Asset management
│   │   ├── network/         # Network configurations
│   │   ├── app-session/     # Application sessions
│   │   └── node/            # Node infrastructure
│   ├── worker/              # Background synchronization services
│   ├── common/              # Shared components
│   │   ├── dto/             # Data Transfer Objects
│   │   ├── decorators/      # Custom decorators
│   │   ├── exceptions/      # Error handling
│   │   ├── filters/         # Exception filters
│   │   ├── interceptors/    # Response interceptors
│   │   └── types/           # TypeScript type definitions
│   └── config/              # Configuration and validation
├── prisma/
│   ├── schema.prisma        # Database schema
│   ├── migrations/          # Database migrations
│   └── seed.ts              # Database seeding
└── test/                    # End-to-end tests
```

### Adding New Endpoints

1. **Create DTO classes** in appropriate module's `dto/` directory
2. **Implement service** with business logic
3. **Add controller** with proper decorators for throttling and caching
4. **Add tests** for both unit and integration scenarios
5. **Update API documentation**

### Database Operations

```bash
# Create new migration
npx prisma migrate dev --name migration_name

# Generate Prisma client
npx prisma generate

# Deploy migrations to production
npx prisma migrate deploy

# Seed database
npm run prisma:seed
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov

# Run E2E tests
npm run test:e2e

# Debug tests
npm run test:debug
```

## Monitoring & Observability

### Health Checks

- API server health: `GET /`
- Database connectivity automatically validated
- External service status tracked via worker

### Logging

- Structured JSON logging in production
- Request/response logging with correlation IDs
- Error tracking with stack traces
- Worker synchronization progress logging

### Performance

- Response caching with appropriate TTLs
- Database query optimization with indexes
- Rate limiting on all endpoints
- Connection pooling for database

## Deployment

### Docker Support

```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Production stage  
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
```

### Environment Setup

1. Set up PostgreSQL database
2. Configure environment variables
3. Run database migrations
4. Start both API and worker processes
5. Configure reverse proxy (nginx) for production

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for your changes
5. Run the test suite (`npm test`)
6. Run the linter (`npm run lint`)
7. Commit your changes (`git commit -m 'Add amazing feature'`)
8. Push to the branch (`git push origin feature/amazing-feature`)
9. Open a Pull Request

### Code Style

- TypeScript with strict type checking
- ESLint configuration for consistent formatting
- Prettier for code formatting
- Conventional commit messages

## License

This project is licensed under the UNLICENSED License - see the package.json for details.

## Support

For issues and questions:

1. Check the [API documentation](./API.md)
2. Review existing issues in the repository
3. Create a new issue with detailed information
4. For security vulnerabilities, please report privately

## Roadmap

- [ ] GraphQL API support
- [ ] WebSocket real-time updates for clients
- [ ] Enhanced analytics and reporting
- [ ] Multi-tenant support
- [ ] Advanced monitoring dashboard
- [ ] Performance optimization for high-volume scenarios
