# Use Node.js 20 LTS for better compatibility with native dependencies
FROM node:20-slim

# Set working directory
WORKDIR /app

# Install system dependencies for sharp and native modules
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    python3 \
    make \
    g++ \
    libpixman-1-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create necessary directories
RUN mkdir -p uploads uploads/criminals uploads/evidence temp

# Create non-root user for security
RUN groupadd -r nodejs && useradd -r -g nodejs nodejs

# Change ownership of app directory
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port (Render uses PORT env var)
EXPOSE 10000

# Set environment variables
ENV NODE_ENV=production

# Health check - use dynamic PORT
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get(`http://localhost:${process.env.PORT || 10000}/api/health`, (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["npm", "start"]
