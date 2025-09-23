# Server Deployment Guide

## Production Setup

### Server Requirements
- **Node.js**: 18.0 or higher
- **Memory**: 512MB minimum, 1GB recommended
- **Storage**: 10GB minimum for chat data growth
- **Network**: HTTPS capability for production use

### Environment Preparation
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js via NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # v18.x.x
npm --version   # 9.x.x
```

## Process Management with PM2

### PM2 Installation and Setup
```bash
# Install PM2 globally
sudo npm install -g pm2

# Create ecosystem file
# ecosystem.config.js
module.exports = {
  apps: [{
    name: 'polyglot-sync',
    script: 'src/server/chatSyncApi.js',
    cwd: '/path/to/polyglot',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development',
      CHAT_SYNC_PORT: 4001
    },
    env_production: {
      NODE_ENV: 'production',
      CHAT_SYNC_PORT: 4001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

### PM2 Operations
```bash
# Start application
pm2 start ecosystem.config.js --env production

# Monitor processes
pm2 status
pm2 logs polyglot-sync
pm2 monit

# Auto-start on system reboot
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME
pm2 save

# Restart application
pm2 restart polyglot-sync

# Stop application
pm2 stop polyglot-sync
pm2 delete polyglot-sync
```

## Reverse Proxy Setup

### Nginx Configuration

#### Installation
```bash
# Install Nginx
sudo apt install nginx

# Create configuration
sudo nano /etc/nginx/sites-available/polyglot-sync
```

#### Server Block Configuration
```nginx
# /etc/nginx/sites-available/polyglot-sync
server {
    listen 80;
    server_name api.yourapp.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourapp.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/api.yourapp.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourapp.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000" always;

    # Proxy configuration
    location / {
        proxy_pass http://127.0.0.1:4001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Rate limiting
    location /sync {
        limit_req zone=api burst=10 nodelay;
        proxy_pass http://127.0.0.1:4001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Rate limiting zone
http {
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/m;
}
```

#### Enable Configuration
```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/polyglot-sync /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### SSL Certificate Setup

#### Let's Encrypt with Certbot
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d api.yourapp.com

# Auto-renewal setup
sudo crontab -e
# Add line: 0 12 * * * /usr/bin/certbot renew --quiet
```

#### Manual SSL Certificate
```bash
# If using purchased SSL certificate
sudo mkdir -p /etc/ssl/certs/polyglot
sudo cp yourapp.com.crt /etc/ssl/certs/polyglot/
sudo cp yourapp.com.key /etc/ssl/private/
sudo chmod 600 /etc/ssl/private/yourapp.com.key
```

## Cloud Platform Deployment

### Heroku Deployment

#### Preparation
```json
// package.json - Add engines and scripts
{
  "engines": {
    "node": "18.x",
    "npm": "9.x"
  },
  "scripts": {
    "start": "node src/server/chatSyncApi.js",
    "heroku-postbuild": "echo 'No build step required'"
  }
}
```

#### Procfile
```
# Procfile
web: node src/server/chatSyncApi.js
```

#### Deployment
```bash
# Install Heroku CLI and login
heroku login

# Create app
heroku create polyglot-sync-api

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set CHAT_SYNC_PORT=process.env.PORT

# Deploy
git add .
git commit -m "Deploy to Heroku"
git push heroku main

# View logs
heroku logs --tail
```

### Railway Deployment

#### Railway CLI Setup
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and initialize
railway login
railway init
```

#### Railway Configuration
```toml
# railway.toml
[build]
  builder = "nixpacks"

[deploy]
  startCommand = "node src/server/chatSyncApi.js"
  healthcheckPath = "/"
  healthcheckTimeout = 100
  restartPolicyType = "on_failure"
  restartPolicyMaxRetries = 10

[[services]]
  name = "polyglot-sync"

  [services.env]
    NODE_ENV = "production"
```

#### Deploy
```bash
# Deploy to Railway
railway up

# Set custom domain
railway domain add api.yourapp.com
```

### DigitalOcean App Platform

#### App Spec Configuration
```yaml
# .do/app.yaml
name: polyglot-sync
services:
- name: api
  source_dir: /
  github:
    repo: your-username/polyglot
    branch: main
  run_command: node src/server/chatSyncApi.js
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  env:
  - key: NODE_ENV
    value: production
  - key: CHAT_SYNC_PORT
    value: "8080"
  routes:
  - path: /
```

#### Deploy via CLI
```bash
# Install doctl
snap install doctl

# Authenticate
doctl auth init

# Create app
doctl apps create .do/app.yaml

# Monitor deployment
doctl apps list
doctl apps logs <app-id>
```

## Container Deployment

### Docker Setup

#### Dockerfile
```dockerfile
# Dockerfile
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy server files
COPY src/server/ ./
COPY package*.json ./

# Install dependencies (if any)
RUN npm ci --only=production && npm cache clean --force

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Create data directory for chat storage
RUN mkdir -p /app/data && chown nodejs:nodejs /app/data

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 4001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4001/health', (res) => { \
    process.exit(res.statusCode === 200 ? 0 : 1) \
  }).on('error', () => process.exit(1))"

# Start server
CMD ["node", "chatSyncApi.js"]
```

#### Build and Run
```bash
# Build image
docker build -t polyglot-sync .

# Run container
docker run -d \
  --name polyglot-sync \
  -p 4001:4001 \
  -v $(pwd)/data:/app/data \
  --restart unless-stopped \
  polyglot-sync

# View logs
docker logs -f polyglot-sync
```

### Docker Compose
```yaml
# docker-compose.yml
version: '3.8'

services:
  sync-api:
    build: .
    container_name: polyglot-sync
    ports:
      - "4001:4001"
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    environment:
      - NODE_ENV=production
      - CHAT_SYNC_PORT=4001
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:4001/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    container_name: polyglot-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl/certs
    depends_on:
      - sync-api
    restart: unless-stopped
```

### Kubernetes Deployment

#### Deployment Manifest
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: polyglot-sync
spec:
  replicas: 2
  selector:
    matchLabels:
      app: polyglot-sync
  template:
    metadata:
      labels:
        app: polyglot-sync
    spec:
      containers:
      - name: sync-api
        image: polyglot-sync:latest
        ports:
        - containerPort: 4001
        env:
        - name: NODE_ENV
          value: "production"
        - name: CHAT_SYNC_PORT
          value: "4001"
        volumeMounts:
        - name: data-volume
          mountPath: /app/data
        resources:
          limits:
            memory: "1Gi"
            cpu: "500m"
          requests:
            memory: "512Mi"
            cpu: "250m"
        livenessProbe:
          httpGet:
            path: /health
            port: 4001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 4001
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: data-volume
        persistentVolumeClaim:
          claimName: polyglot-data-pvc
```

#### Service and Ingress
```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: polyglot-sync-service
spec:
  selector:
    app: polyglot-sync
  ports:
  - protocol: TCP
    port: 80
    targetPort: 4001
  type: ClusterIP

---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: polyglot-sync-ingress
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - api.yourapp.com
    secretName: polyglot-sync-tls
  rules:
  - host: api.yourapp.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: polyglot-sync-service
            port:
              number: 80
```

## Monitoring and Logging

### Application Logging
```javascript
// src/server/logger.js
const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logDir = './logs';
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  log(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...meta
    };

    console.log(JSON.stringify(logEntry));

    // Write to file
    const logFile = path.join(this.logDir, `${level}.log`);
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
  }

  info(message, meta) { this.log('info', message, meta); }
  error(message, meta) { this.log('error', message, meta); }
  warn(message, meta) { this.log('warn', message, meta); }
}

module.exports = new Logger();
```

### Health Check Endpoint
```javascript
// Add to chatSyncApi.js
const os = require('os');
const fs = require('fs');

// Health check endpoint
if (req.method === 'GET' && req.url === '/health') {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    system: {
      platform: os.platform(),
      arch: os.arch(),
      loadavg: os.loadavg(),
      freemem: os.freemem(),
      totalmem: os.totalmem()
    },
    storage: {
      chatCount: getAllChats().length,
      storeExists: fs.existsSync(STORE_PATH),
      storeSize: fs.existsSync(STORE_PATH) ? fs.statSync(STORE_PATH).size : 0
    }
  };

  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify(health, null, 2));
}
```

### Performance Monitoring
```javascript
// Add request timing middleware
const requestStart = Date.now();

// ... handle request ...

const requestEnd = Date.now();
const duration = requestEnd - requestStart;

logger.info('Request completed', {
  method: req.method,
  url: req.url,
  duration: `${duration}ms`,
  status: res.statusCode
});
```

## Security Hardening

### Firewall Configuration
```bash
# UFW firewall setup
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### System Security
```bash
# Disable root login
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no

# Update system regularly
sudo apt install unattended-upgrades
sudo dpkg-reconfigure unattended-upgrades
```

### Application Security
```javascript
// Add to server startup
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection:', { reason, promise });
});
```

## Backup and Recovery

### Automated Backup
```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/polyglot"
DATA_DIR="/path/to/polyglot/src/server"

mkdir -p $BACKUP_DIR

# Backup chat data
cp $DATA_DIR/chatStore.json $BACKUP_DIR/chatStore_$DATE.json

# Compress old backups
find $BACKUP_DIR -name "chatStore_*.json" -mtime +7 -exec gzip {} \;

# Remove backups older than 30 days
find $BACKUP_DIR -name "chatStore_*.json.gz" -mtime +30 -delete
```

### Cron Job Setup
```bash
# Add to crontab
crontab -e

# Backup every 6 hours
0 */6
