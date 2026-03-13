SHELL := /bin/sh
ENV_FILE ?= .env.local
DOCKER_COMPOSE ?= docker compose

.PHONY: help env-local check-env db-up db-down db-logs db-psql db-url prisma-generate prisma-migrate prisma-migrate-dev prisma-reset seed dev-api dev-worker bootstrap

help:
	@echo "Local development commands:"
	@echo "  make env-local        # Create .env.local from template if missing"
	@echo "  make db-up            # Start local Postgres in Docker"
	@echo "  make db-down          # Stop local Postgres"
	@echo "  make db-logs          # Tail Postgres logs"
	@echo "  make db-psql          # Open psql shell inside Postgres container"
	@echo "  make prisma-migrate   # Apply migrations to local DB"
	@echo "  make prisma-migrate-dev # Create+apply a new migration"
	@echo "  make seed             # Seed local DB"
	@echo "  make dev-api          # Start API with local env"
	@echo "  make dev-worker       # Start worker with local env"
	@echo "  make bootstrap        # env-local + db-up + prisma-generate + prisma-migrate"

env-local:
	@if [ ! -f "$(ENV_FILE)" ]; then \
		cp .env.local.example "$(ENV_FILE)"; \
		echo "Created $(ENV_FILE) from .env.local.example"; \
	else \
		echo "Using existing $(ENV_FILE)"; \
	fi

check-env:
	@if [ ! -f "$(ENV_FILE)" ]; then \
		echo "Missing $(ENV_FILE). Run 'make env-local' first."; \
		exit 1; \
	fi

db-up:
	@$(DOCKER_COMPOSE) up -d postgres

db-down:
	@$(DOCKER_COMPOSE) stop postgres

db-logs:
	@$(DOCKER_COMPOSE) logs -f postgres

db-psql:
	@$(DOCKER_COMPOSE) exec postgres psql -U nexus -d nexus

db-url:
	@echo "postgresql://nexus:password@localhost:5432/nexus"

prisma-generate: check-env
	@set -a; . ./$(ENV_FILE); set +a; npx prisma generate

prisma-migrate: check-env db-up
	@set -a; . ./$(ENV_FILE); set +a; npx prisma migrate deploy

prisma-migrate-dev: check-env db-up
	@set -a; . ./$(ENV_FILE); set +a; npx prisma migrate dev

prisma-reset: check-env db-up
	@set -a; . ./$(ENV_FILE); set +a; npx prisma migrate reset --force

seed: check-env
	@set -a; . ./$(ENV_FILE); set +a; npm run prisma:seed

dev-api: check-env
	@set -a; . ./$(ENV_FILE); set +a; ENV_FILE=$(ENV_FILE) npm run start:dev

dev-worker: check-env
	@set -a; . ./$(ENV_FILE); set +a; ENV_FILE=$(ENV_FILE) npm run start:worker:dev

bootstrap: env-local db-up prisma-generate prisma-migrate
