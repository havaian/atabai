# Build stage
FROM node:24-alpine AS builder

# Set working directory
WORKDIR /app

# Install git for potential dependencies
RUN apk add --no-cache git

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Define build arguments
ARG VITE_API_BASE_URL
ARG VITE_APP_TITLE
ARG VITE_APP_DESCRIPTION
ARG VITE_GOOGLE_CLIENT_ID

# Set environment variables from build args
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_APP_TITLE=$VITE_APP_TITLE
ENV VITE_APP_DESCRIPTION=$VITE_APP_DESCRIPTION
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

# Build the application
RUN npm run build

# Production stage with nginx
FROM nginx:alpine AS production

# Install curl for health checks
RUN apk add --no-cache curl

# Remove default nginx website
RUN rm -rf /usr/share/nginx/html/*

# Copy built application from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create nginx user and set permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Switch to nginx user for security
USER nginx

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

# Labels for better container management
LABEL maintainer="ATABAI Team"
LABEL description="ATABAI Frontend - Vue 3 SPA with nginx"
LABEL version="1.0.0"

# # Development stage (for local development)
# FROM node:24-alpine AS development

# WORKDIR /app

# # Install development dependencies
# RUN apk add --no-cache git curl

# # Copy package files
# COPY package*.json ./

# # Install all dependencies (including dev)
# RUN npm ci

# # Copy source code
# COPY . .

# # Expose development port
# EXPOSE 8080

# # Start development server
# CMD ["npm", "run", "dev"]
