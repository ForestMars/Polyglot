# Docker Deployment

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
        max_attempts: 3

    environment:
      - POSTGRES_DB=polyglot_research
      - POSTGRES_USER=research_user
      - POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password

    volumes:
      - type: volume
        source: research_db_data
        target: /var/lib/postgresql/data
        volume:
          nocopy: true

    networks:
      - research-backend

    secrets:
      - postgres_password

  research-cache:
    image: redis:7-alpine

    deploy:
      replicas: 1
      placement:
        constraints:
          - node.labels.research.cache == redis
      resources:
        limits:
          cpus: '1.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 1G

    command: >
      sh -c "redis-server
      --appendonly yes
      --maxmemory 1536mb
      --maxmemory-policy allkeys-lru
      --requirepass $(cat /run/secrets/redis_password)"

    volumes:
      - type: volume
        source: research_cache_data
        target: /data

    networks:
      - research-backend

    secrets:
      - redis_password

networks:
  research-frontend:
    driver: overlay
    external: true

  research-backend:
    driver: overlay
    driver_opts:
      encrypted: "true"
    internal: true

volumes:
  research_client_config:
    driver: local
  research_db_data:
    driver: local
    driver_opts:
      type: nfs
      o: addr=research-nfs.internal,rw
      device: ":/research/database"
  research_cache_data:
    driver: local

secrets:
  postgres_password:
    external: true
  redis_password:
    external: true
  research_jwt_secret:
    external: true
  research_encryption_key:
    external: true
```

**Deploy Research Stack:**

```bash
# Initialize Docker Swarm for research
docker swarm init

# Label nodes for research workload placement
docker node update --label-add research.environment=client worker1
docker node update --label-add research.tier=backend worker2
docker node update --label-add research.storage=database manager1

# Create research secrets
echo "your-postgres-password" | docker secret create postgres_password -
echo "your-redis-password" | docker secret create redis_password -
echo "your-jwt-secret-key" | docker secret create research_jwt_secret -
echo "your-encryption-key" | docker secret create research_encryption_key -

# Create research networks
docker network create --driver overlay research-frontend
docker network create --driver overlay --internal research-backend

# Deploy research stack
docker stack deploy -c docker-stack.research.yml polyglot-research
```

### Kubernetes Deployment

```yaml
# k8s/research-namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: polyglot-research
  labels:
    name: polyglot-research
    environment: production
    purpose: ai-research

---
# k8s/research-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: research-config
  namespace: polyglot-research
data:
  RESEARCH_MODE: "kubernetes"
  COLLABORATION_FEATURES: "true"
  PRIVACY_PRESERVING_SYNC: "true"
  ZERO_KNOWLEDGE_MODE: "true"
  MAX_TEAM_SIZE: "50"
  MAX_PROJECTS_PER_RESEARCHER: "25"

---
# k8s/research-secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: research-secrets
  namespace: polyglot-research
type: Opaque
stringData:
  DATABASE_URL: postgresql://research_user:secure_password@research-postgres:5432/polyglot_research
  REDIS_URL: redis://research-redis:6379
  JWT_SECRET: your-super-secure-jwt-secret
  ENCRYPTION_KEY: your-encryption-key-for-research

---
# k8s/research-postgres.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: research-postgres
  namespace: polyglot-research
spec:
  serviceName: research-postgres
  replicas: 1
  selector:
    matchLabels:
      app: research-postgres

  template:
    metadata:
      labels:
        app: research-postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine

        env:
        - name: POSTGRES_DB
          value: polyglot_research
        - name: POSTGRES_USER
          value: research_user
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password

        ports:
        - containerPort: 5432

        volumeMounts:
        - name: postgres-data
          mountPath: /var/lib/postgresql/data
        - name: postgres-init
          mountPath: /docker-entrypoint-initdb.d
          readOnly: true

        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"

        livenessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - research_user
            - -d
            - polyglot_research
          initialDelaySeconds: 30
          periodSeconds: 30

        readinessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - research_user
            - -d
            - polyglot_research
          initialDelaySeconds: 5
          periodSeconds: 10

      volumes:
      - name: postgres-init
        configMap:
          name: postgres-init-scripts

  volumeClaimTemplates:
  - metadata:
      name: postgres-data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: research-ssd
      resources:
        requests:
          storage: 100Gi

---
# k8s/research-sync-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: research-sync
  namespace: polyglot-research
spec:
  replicas: 3

  selector:
    matchLabels:
      app: research-sync

  template:
    metadata:
      labels:
        app: research-sync
    spec:
      containers:
      - name: research-sync-server
        image: polyglot/research-sync:latest

        ports:
        - containerPort: 4001

        env:
        - name: NODE_ENV
          value: production

        envFrom:
        - configMapRef:
            name: research-config
        - secretRef:
            name: research-secrets

        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"

        volumeMounts:
        - name: research-data
          mountPath: /app/data
        - name: research-logs
          mountPath: /app/logs

        livenessProbe:
          httpGet:
            path: /health
            port: 4001
          initialDelaySeconds: 60
          periodSeconds: 30
          timeoutSeconds: 10
          failureThreshold: 3

        readinessProbe:
          httpGet:
            path: /ready
            port: 4001
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3

        # Graceful shutdown for research data integrity
        lifecycle:
          preStop:
            exec:
              command:
              - /bin/sh
              - -c
              - "npm run graceful-shutdown"

      volumes:
      - name: research-data
        persistentVolumeClaim:
          claimName: research-data-pvc
      - name: research-logs
        persistentVolumeClaim:
          claimName: research-logs-pvc

---
# k8s/research-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: research-ingress
  namespace: polyglot-research
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "100m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "300"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "300"

spec:
  tls:
  - hosts:
    - research.university.edu
    - sync.research.university.edu
    secretName: research-tls-cert

  rules:
  - host: research.university.edu
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: research-client-service
            port:
              number: 80

  - host: sync.research.university.edu
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: research-sync-service
            port:
              number: 4001
```

## Research Data Persistence

### Volume Configuration for Research Data

```yaml
# research-volumes.yml
version: '3.8'

# Research data volumes with backup and recovery
volumes:
  # Primary research data storage
  research_conversations:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /research-storage/conversations
    labels:
      backup.policy: "daily"
      retention.period: "permanent"
      importance: "critical"

  # Memory context and research insights
  research_memory_contexts:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /research-storage/memory-contexts
    labels:
      backup.policy: "real-time"
      retention.period: "permanent"
      importance: "critical"

  # Knowledge base and RAG documents
  research_knowledge_base:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /research-storage/knowledge-base
    labels:
      backup.policy: "daily"
      retention.period: "permanent"
      importance: "high"

  # Research analytics and metrics
  research_analytics:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /research-storage/analytics
    labels:
      backup.policy: "weekly"
      retention.period: "5-years"
      importance: "medium"

  # Temporary research data and caches
  research_temp:
    driver: local
    labels:
      backup.policy: "none"
      retention.period: "30-days"
      importance: "low"

# Backup service for research data
services:
  research-backup:
    image: polyglot/research-backup:latest
    container_name: research-backup-service

    volumes:
      - research_conversations:/source/conversations:ro
      - research_memory_contexts:/source/memory-contexts:ro
      - research_knowledge_base:/source/knowledge-base:ro
      - research_analytics:/source/analytics:ro
      - /backup-storage/research:/backup

    environment:
      - BACKUP_SCHEDULE=0 2 * * * # Daily at 2 AM
      - BACKUP_RETENTION_DAYS=365
      - BACKUP_COMPRESSION=true
      - BACKUP_ENCRYPTION=true
      - BACKUP_VERIFICATION=true

    command: >
      sh -c "
      # Create research data backup script
      cat > /backup-research.sh << 'EOF'
      #!/bin/bash
      set -e

      TIMESTAMP=$(date +%Y%m%d_%H%M%S)
      BACKUP_DIR=/backup/research_backup_$TIMESTAMP

      echo 'Starting research data backup...'
      mkdir -p $BACKUP_DIR

      # Backup critical research data with verification
      echo 'Backing up conversations...'
      tar -czf $BACKUP_DIR/conversations.tar.gz -C /source conversations/

      echo 'Backing up memory contexts...'
      tar -czf $BACKUP_DIR/memory-contexts.tar.gz -C /source memory-contexts/

      echo 'Backing up knowledge base...'
      tar -czf $BACKUP_DIR/knowledge-base.tar.gz -C /source knowledge-base/

      echo 'Backing up analytics...'
      tar -czf $BACKUP_DIR/analytics.tar.gz -C /source analytics/

      # Create backup manifest with checksums
      cd $BACKUP_DIR
      sha256sum *.tar.gz > backup_checksums.txt

      # Encrypt backup if required
      if [ \"$BACKUP_ENCRYPTION\" = \"true\" ]; then
        echo 'Encrypting backup...'
        for file in *.tar.gz; do
          gpg --cipher-algo AES256 --compress-algo 1 --symmetric --output $file.gpg $file
          rm $file
        done
        gpg --cipher-algo AES256 --compress-algo 1 --symmetric --output backup_checksums.txt.gpg backup_checksums.txt
        rm backup_checksums.txt
      fi

      echo 'Research backup completed successfully'

      # Cleanup old backups based on retention policy
      find /backup -name 'research_backup_*' -type d -mtime +$BACKUP_RETENTION_DAYS -exec rm -rf {} +

      EOF

      chmod +x /backup-research.sh

      # Run backup on schedule
      echo '$BACKUP_SCHEDULE /backup-research.sh' | crontab -
      crond -f
      "
```

## Development and Testing

### Research Development Environment

```dockerfile
# Dockerfile.research-dev
FROM node:18-alpine

# Install development tools for research environment
RUN apk add --no-cache \
    git \
    curl \
    wget \
    vim \
    postgresql-client \
    redis-tools

WORKDIR /app

# Copy package files for research development
COPY package*.json ./
COPY research-config/ ./research-config/

# Install all dependencies including dev tools
RUN npm install

# Copy source code
COPY . .

# Expose development ports
EXPOSE 3000 4001 5173

# Research development with hot reloading
CMD ["npm", "run", "dev:research"]
```

**Development Docker Compose:**

```yaml
# docker-compose.research-dev.yml
version: '3.8'

services:
  research-dev:
    build:
      context: .
      dockerfile: Dockerfile.research-dev

    container_name: polyglot-research-dev

    ports:
      - "3000:3000"   # Client dev server
      - "4001:4001"   # Sync server dev
      - "5173:5173"   # Vite dev server

    environment:
      - NODE_ENV=development
      - RESEARCH_MODE=development
      - HOT_RELOAD=true
      - DEBUG_RESEARCH_FEATURES=true

    volumes:
      - .:/app
      - /app/node_modules
      - research_dev_data:/app/data

    networks:
      - research-dev-network

  research-dev-db:
    image: postgres:15-alpine
    container_name: research-dev-db

    environment:
      - POSTGRES_DB=polyglot_research_dev
      - POSTGRES_USER=dev_user
      - POSTGRES_PASSWORD=dev_password

    ports:
      - "5432:5432"

    volumes:
      - research_dev_db:/var/lib/postgresql/data

    networks:
      - research-dev-network

  research-dev-redis:
    image: redis:7-alpine
    container_name: research-dev-redis

    ports:
      - "6379:6379"

    networks:
      - research-dev-network

volumes:
  research_dev_data:
  research_dev_db:

networks:
  research-dev-network:
    driver: bridge
```

## Container Security for Research

### Research Data Security Configuration

```yaml
# security/research-security-context.yml
apiVersion: v1
kind: SecurityContext
metadata:
  name: research-security-context
  namespace: polyglot-research

# Pod Security Context for research containers
podSecurityContext:
  runAsNonRoot: true
  runAsUser: 1000
  runAsGroup: 1000
  fsGroup: 1000
  seccompProfile:
    type: RuntimeDefault

# Container Security Context
securityContext:
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  runAsNonRoot: true
  runAsUser: 1000
  capabilities:
    drop:
      - ALL
    add:
      - NET_BIND_SERVICE  # Only if needed for port binding

# Network Policy for research environment isolation
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: research-network-policy
  namespace: polyglot-research
spec:
  podSelector:
    matchLabels:
      app: research

  policyTypes:
  - Ingress
  - Egress

  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: polyglot-research
    - podSelector:
        matchLabels:
          role: research-client
    ports:
    - protocol: TCP
      port: 4001

  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: polyglot-research
    ports:
    - protocol: TCP
      port: 5432  # PostgreSQL
    - protocol: TCP
      port: 6379  # Redis

  # Allow AI API access
  - to: []
    ports:
    - protocol: TCP
      port: 443
    - protocol: TCP
      port: 80
```

This containerized deployment ensures that research teams can deploy Polyglot consistently across different infrastructure environments while maintaining data security, research integrity, and collaboration capabilities.
