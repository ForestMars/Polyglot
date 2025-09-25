### Docker Swarm for Research Teams

```yaml
# docker-stack.research.yml
version: '3.8'

services:
  research-client:
    image: polyglot/research-client:latest

    deploy:
      replicas: 2
      placement:
        constraints:
          - node.role == worker
          - node.labels.research.environment == client
      resources:
        limits:
          cpus: '1.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 1G
      restart_policy:
        condition: on-failure
        delay: 10s
        max_attempts: 3
        window: 60s
      update_config:
        parallelism: 1
        delay: 30s
        failure_action: rollback
        order: stop-first

    ports:
      - "3000:80"

    environment:
      - RESEARCH_MODE=team_swarm
      - LOAD_BALANCER_AWARE=true

    networks:
      - research-frontend
      - research-backend

    volumes:
      - type: volume
        source: research_client_config
        target: /etc/nginx/conf.d
        read_only: true

  research-sync:
    image: polyglot/research-sync:latest

    deploy:
      replicas: 3
      placement:
        constraints:
          - node.role == worker
          - node.labels.research.tier == backend
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
      restart_policy:
        condition: on-failure
        delay: 15s
        max_attempts: 5
        window: 120s

    ports:
      - "4001:4001"

    environment:
      - NODE_ENV=production
      - RESEARCH_MODE=swarm_cluster
      - CLUSTER_MODE=true
      - DATABASE_URL=postgresql://research_user:${POSTGRES_PASSWORD}@research-db:5432/polyglot_research
      - REDIS_URL=redis://research-cache:6379

    networks:
      - research-backend

    secrets:
      - source: research_jwt_secret
        target: /run/secrets/jwt_secret
      - source: research_encryption_key
        target: /run/secrets/encryption_key

  research-db:
    image: postgres:15-alpine

    deploy:
      replicas: 1
      placement:
        constraints:
          - node.role == manager
          - node.labels.research.storage == database
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
      restart_policy:
        condition: on-failure
        delay: 30s
        max# Docker Deployment

Deploy Polyglot in containerized research environments for consistent, scalable, and isolated AI research workflows across different infrastructure setups.

## Research Environment Containers

### Individual Researcher Container

Perfect for researchers who want a consistent, portable research environment across different machines.

```dockerfile
# Dockerfile.researcher
FROM node:18-alpine AS builder

# Build research client with individual optimizations
WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build:research-individual

# Production container for individual research
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY config/nginx/research-individual.conf /etc/nginx/conf.d/default.conf

# Research-optimized nginx configuration
EXPOSE 80

# Health check for research environment
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

**Run Individual Research Container:**

```bash
# Build individual research container
docker build -f Dockerfile.researcher -t polyglot-research:individual .

# Run with research data persistence
docker run -d \
  --name polyglot-individual-research \
  -p 3000:80 \
  -v polyglot_research_data:/usr/share/nginx/html/data \
  -e RESEARCH_MODE=individual \
  -e MEMORY_RETENTION=permanent \
  polyglot-research:individual
```

### Research Team Container Stack

Complete containerized environment for research teams with collaboration features.

```yaml
# docker-compose.research-team.yml
version: '3.8'

services:
  # Research client interface
  research-client:
    build:
      context: .
      dockerfile: Dockerfile.research-team
      args:
        - RESEARCH_MODE=collaborative
        - TEAM_SIZE=small

    container_name: polyglot-research-client

    ports:
      - "3000:80"

    environment:
      - RESEARCH_ENVIRONMENT=team
      - COLLABORATION_FEATURES=true
      - SYNC_SERVER_URL=http://research-sync:4001
      - PRIVACY_PRESERVING_SYNC=true

    volumes:
      - research_client_config:/etc/nginx/conf.d

    depends_on:
      - research-sync

    networks:
      - research-network

    restart: unless-stopped

  # Research sync server for team coordination
  research-sync:
    build:
      context: .
      dockerfile: Dockerfile.research-sync

    container_name: polyglot-research-sync

    ports:
      - "4001:4001"

    environment:
      - NODE_ENV=production
      - RESEARCH_MODE=team_collaboration
      - MAX_TEAM_SIZE=10
      - DATABASE_URL=postgresql://research_user:${POSTGRES_PASSWORD}@research-db:5432/polyglot_research
      - REDIS_URL=redis://research-cache:6379
      - ZERO_KNOWLEDGE_MODE=true
      - PRIVACY_FIRST=true

    volumes:
      - research_sync_data:/app/data
      - research_sync_logs:/app/logs

    depends_on:
      - research-db
      - research-cache

    networks:
      - research-network

    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

    restart: unless-stopped

  # PostgreSQL for research data integrity
  research-db:
    image: postgres:15-alpine
    container_name: polyglot-research-db

    environment:
      - POSTGRES_DB=polyglot_research
      - POSTGRES_USER=research_user
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_INITDB_ARGS=--encoding=UTF-8

    volumes:
      - research_db_data:/var/lib/postgresql/data
      - ./sql/research-schema.sql:/docker-entrypoint-initdb.d/01-schema.sql
      - ./sql/research-indexes.sql:/docker-entrypoint-initdb.d/02-indexes.sql

    networks:
      - research-network

    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U research_user -d polyglot_research"]
      interval: 30s
      timeout: 10s
      retries: 5

    restart: unless-stopped

  # Redis for research performance caching
  research-cache:
    image: redis:7-alpine
    container_name: polyglot-research-cache

    command: redis-server --appendonly yes --maxmemory 1gb --maxmemory-policy allkeys-lru

    volumes:
      - research_cache_data:/data

    networks:
      - research-network

    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

    restart: unless-stopped

  # Ollama for local AI models (optional)
  research-ollama:
    image: ollama/ollama:latest
    container_name: polyglot-research-ollama

    ports:
      - "11434:11434"

    volumes:
      - research_ollama_models:/root/.ollama

    environment:
      - OLLAMA_HOST=0.0.0.0
      - OLLAMA_MODELS=/root/.ollama/models

    networks:
      - research-network

    # GPU support for local models (uncomment if GPU available)
    # deploy:
    #   resources:
    #     reservations:
    #       devices:
    #         - driver: nvidia
    #           count: 1
    #           capabilities: [gpu]

    restart: unless-stopped

volumes:
  research_client_config:
    driver: local
  research_sync_data:
    driver: local
  research_sync_logs:
    driver: local
  research_db_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /opt/polyglot-research/database
  research_cache_data:
    driver: local
  research_ollama_models:
    driver: local

networks:
  research-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.25.0.0/16
```

### Research Organization Container

Enterprise-grade containerized deployment for large research organizations.

```dockerfile
# Dockerfile.research-enterprise
FROM node:18-alpine AS research-builder

# Install build dependencies for research features
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY research-config/ ./research-config/

# Install dependencies with research optimizations
RUN npm ci --include=dev

# Copy source code
COPY . .

# Build for enterprise research environment
RUN npm run build:research-enterprise

# Production stage with enterprise security
FROM nginx:alpine

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache curl

# Copy research application
COPY --from=research-builder /app/dist /usr/share/nginx/html

# Copy enterprise nginx configuration
COPY config/nginx/research-enterprise.conf /etc/nginx/conf.d/default.conf
COPY config/nginx/security-headers.conf /etc/nginx/conf.d/security.conf

# Create research data directories
RUN mkdir -p /var/research/data /var/research/logs /var/research/backups && \
    chown -R nginx:nginx /var/research

# Security: run as non-root user
USER nginx

EXPOSE 80 443

# Enhanced health check for enterprise environment
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f -H "User-Agent: HealthCheck" http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

## Production Docker Deployment

### Docker Swarm for Research Teams

```yaml
# docker-stack.research.yml
version: '3.8'

services:
  research-client:
    image: polyglot/research-client:latest

    deploy:
      replicas: 2
      placement:
        constraints:
          - node.role == worker
          - node.labels.research.environment == client
      resources:
        limits:
          cpus: '1.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 1G
      restart_policy:
        condition: on-failure
        delay: 10s
        max_attempts: 3
        window: 60s
      update_
