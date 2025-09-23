# Client Deployment Guide

## Build Process

### Production Build
```bash
# Install dependencies
npm install

# Create production build
npm run build

# Output directory: dist/
ls dist/
# index.html
# assets/index-[hash].js
# assets/index-[hash].css
# assets/[other-assets]
```

### Build Configuration
```javascript
// vite.config.js
export default {
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,        // Disable for production
    minify: 'terser',        // Aggressive minification
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'dexie']
        }
      }
    }
  }
}
```

### Environment Variables
```bash
# .env.production
VITE_SYNC_SERVER_URL=https://api.yourapp.com
VITE_APP_NAME=Polyglot
VITE_APP_VERSION=1.0.0
VITE_ENABLE_SYNC=true
```

## Static Hosting Deployment

### Vercel (Recommended)

#### Automatic Deployment
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to production
vercel --prod
```

#### Manual Configuration
```json
// vercel.json
{
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "buildCommand": "npm run build",
        "outputDirectory": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ],
  "env": {
    "VITE_SYNC_SERVER_URL": "@sync_server_url"
  }
}
```

#### Environment Setup
```bash
# Set production environment variables
vercel env add VITE_SYNC_SERVER_URL production
# Enter: https://api.yourapp.com

vercel env add VITE_ENABLE_SYNC production
# Enter: true
```

### Netlify

#### Git-Based Deployment
1. Connect GitHub repository to Netlify
2. Configure build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Node version**: `18`

#### Netlify Configuration
```toml
# netlify.toml
[build]
  publish = "dist"
  command = "npm run build"

[build.environment]
  NODE_VERSION = "18"
  VITE_SYNC_SERVER_URL = "https://api.yourapp.com"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

#### Manual Deployment
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Build and deploy
npm run build
netlify deploy --prod --dir=dist
```

### AWS S3 + CloudFront

#### S3 Bucket Setup
```bash
# Create S3 bucket
aws s3 mb s3://polyglot-app

# Configure bucket for static hosting
aws s3 website s3://polyglot-app \
  --index-document index.html \
  --error-document index.html
```

#### Upload Build
```bash
# Build and upload
npm run build
aws s3 sync dist/ s3://polyglot-app --delete

# Set proper MIME types
aws s3 cp dist/ s3://polyglot-app \
  --recursive \
  --metadata-directive REPLACE \
  --cache-control max-age=31536000
```

#### CloudFront Distribution
```json
{
  "DistributionConfig": {
    "Origins": [{
      "Id": "S3Origin",
      "DomainName": "polyglot-app.s3.amazonaws.com",
      "S3OriginConfig": {
        "OriginAccessIdentity": ""
      }
    }],
    "DefaultCacheBehavior": {
      "TargetOriginId": "S3Origin",
      "ViewerProtocolPolicy": "redirect-to-https",
      "Compress": true
    },
    "CustomErrorResponses": [{
      "ErrorCode": 404,
      "ResponseCode": 200,
      "ResponsePagePath": "/index.html"
    }]
  }
}
```

### GitHub Pages

#### Workflow Setup
```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
        env:
          VITE_SYNC_SERVER_URL: ${{ secrets.SYNC_SERVER_URL }}

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

## Container Deployment

### Docker Setup

#### Dockerfile
```dockerfile
# Build stage
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### Nginx Configuration
```nginx
# nginx.conf
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    server {
        listen 80;
        server_name _;
        root /usr/share/nginx/html;
        index index.html;

        # Handle client-side routing
        location / {
            try_files $uri $uri/ /index.html;
        }

        # Cache static assets
        location /assets/ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
    }
}
```

#### Build and Run
```bash
# Build Docker image
docker build -t polyglot-client .

# Run container
docker run -p 8080:80 polyglot-client

# Access at http://localhost:8080
```

### Docker Compose
```yaml
# docker-compose.yml
version: '3.8'
services:
  client:
    build: .
    ports:
      - "8080:80"
    environment:
      - VITE_SYNC_SERVER_URL=http://localhost:4001
    restart: unless-stopped
```

## Performance Optimization

### Build Optimization
```javascript
// vite.config.js optimizations
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          storage: ['dexie'],
          utils: ['lodash', 'date-fns']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },

  // Enable tree shaking
  esbuild: {
    drop: ['console', 'debugger']  // Remove in production
  }
}
```

### Asset Optimization
```bash
# Image optimization (if using images)
npm install --save-dev @squoosh/cli

# Optimize images in build process
npx @squoosh/cli --resize {width:800} --webp auto src/assets/*.{jpg,png}
```

### CDN Configuration
```html
<!-- Preload critical resources -->
<link rel="preload" href="/assets/index-[hash].js" as="script">
<link rel="preload" href="/assets/index-[hash].css" as="style">

<!-- DNS prefetch for external resources -->
<link rel="dns-prefetch" href="//api.yourapp.com">
```

## Security Configuration

### Content Security Policy
```html
<!-- index.html -->
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  connect-src 'self' https://api.yourapp.com;
  img-src 'self' data: https:;
">
```

### HTTPS Configuration
```javascript
// Force HTTPS in production
if (import.meta.env.PROD && location.protocol !== 'https:') {
  location.replace(`https:${location.href.substring(location.protocol.length)}`);
}
```

### Environment-Specific Security
```javascript
// src/config/security.js
export const securityConfig = {
  development: {
    csp: false,
    httpsRedirect: false,
    syncUrl: 'http://localhost:4001'
  },
  production: {
    csp: true,
    httpsRedirect: true,
    syncUrl: 'https://api.yourapp.com'
  }
};
```

## Monitoring and Analytics

### Error Tracking Setup
```javascript
// src/utils/errorTracking.js
export function setupErrorTracking() {
  if (import.meta.env.PROD) {
    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);
      // Send to error tracking service
      fetch('/api/errors', {
        method: 'POST',
        body: JSON.stringify({
          message: event.error.message,
          stack: event.error.stack,
          url: window.location.href,
          timestamp: new Date().toISOString()
        })
      });
    });
  }
}
```

### Performance Monitoring
```javascript
// src/utils/performance.js
export function trackPerformance() {
  if ('performance' in window) {
    window.addEventListener('load', () => {
      const perfData = performance.getEntriesByType('navigation')[0];

      console.log('Performance metrics:', {
        loadTime: perfData.loadEventEnd - perfData.loadEventStart,
        domReady: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
        firstPaint: performance.getEntriesByType('paint')[0]?.startTime
      });
    });
  }
}
```

## Deployment Checklist

### Pre-Deployment
- [ ] Run production build locally
- [ ] Test all features in production build
- [ ] Verify environment variables
- [ ] Check bundle size and performance
- [ ] Test offline functionality
- [ ] Validate HTTPS configuration

### Post-Deployment
- [ ] Verify deployment URL accessibility
- [ ] Test sync server connectivity
- [ ] Check browser console for errors
- [ ] Validate performance metrics
- [ ] Test on multiple devices/browsers
- [ ] Monitor error rates and user feedback

### Rollback Plan
```bash
# Vercel rollback
vercel --prod --force

# Netlify rollback (via dashboard or CLI)
netlify sites:list
netlify api updateSiteDeploy --site-id=SITE_ID --deploy-id=PREVIOUS_DEPLOY_ID

# AWS S3 rollback
aws s3 sync s3://polyglot-app-backup/ s3://polyglot-app --delete
```

## Troubleshooting

### Common Deployment Issues

#### Build Failures
```bash
# Clear cache and retry
npm run clean  # if available
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### Environment Variable Issues
```bash
# Debug environment variables
npm run build -- --debug

# Check variable availability
console.log('Env vars:', import.meta.env);
```

#### Routing Issues (SPA)
```nginx
# Ensure all routes serve index.html
location / {
    try_files $uri $uri/ /index.html;
}
```

#### CORS Issues
```javascript
// Check sync server URL in production
const syncUrl = import.meta.env.VITE_SYNC_SERVER_URL;
console.log('Sync URL:', syncUrl);
```

### Performance Issues
```javascript
// Bundle analyzer
npm install --save-dev rollup-plugin-visualizer

// Add to vite.config.js
import { visualizer } from 'rollup-plugin-visualizer';

export default {
  plugins: [
    visualizer({ filename: 'dist/stats.html' })
  ]
}
```
