# ==============================================================================
# Stage 1: Base / Builder
# Purpose: Installs dependencies efficiently utilizing Docker's layer caching
# ==============================================================================
FROM node:20-alpine AS builder

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy only package.json and package-lock.json first to maximize cache hits
COPY package*.json ./

# Install ALL dependencies (including dev for building/testing if needed)
# Using `npm ci` is faster and more reliable for CI/CD pipelines
RUN npm ci

# Copy the rest of the application source code
COPY . .

# ==============================================================================
# Stage 2: Production (Final Image)
# Purpose: Creates a minimal, secure, production-ready image
# ==============================================================================
FROM node:20-alpine AS production

# Set strict production environment
ENV NODE_ENV=production

# Set the working directory
WORKDIR /usr/src/app

# Copy package files for installing production-only dependencies
COPY package*.json ./

# Install ONLY production dependencies and clean cache to minimize image size
RUN npm ci --omit=dev && npm cache clean --force

# Copy the application source code from the builder stage
COPY --from=builder /usr/src/app/ ./

# Change ownership of the working directory to the built-in non-root 'node' user
# This is a critical security hardening step to prevent container escape vulnerabilities
RUN chown -R node:node /usr/src/app

# Switch context to the non-root user
USER node

# Expose the port the app runs on
EXPOSE 5000

# Define the default command to start the application
CMD ["node", "index.js"]
