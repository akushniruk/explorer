# Backend Dockerfile for NestJS application
FROM node:20-alpine AS base

# Install curl for health check
RUN apk add --no-cache curl

WORKDIR /app

# Copy package files and Prisma schema  
COPY package.json ./
COPY prisma ./prisma

# Build stage
FROM base AS build

# Install all dependencies (including dev for Prisma)
RUN npm install

# Copy source code
COPY . .

# Generate Prisma client and build the application
RUN npx prisma generate
RUN npm run build:api

# Production stage
FROM node:20-alpine AS production

# Install curl for health check
RUN apk add --no-cache curl

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

# Copy built application and production dependencies
COPY --from=build --chown=nestjs:nodejs /app/dist ./dist
COPY --from=build --chown=nestjs:nodejs /app/package.json ./
COPY --from=build --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=build --chown=nestjs:nodejs /app/node_modules ./node_modules

# Switch to non-root user
USER nestjs

# Expose ports
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/v1/health || exit 1

# Start the API application by default
CMD ["node", "dist/src/main.js"]