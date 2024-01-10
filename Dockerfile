# Build stage
FROM node:18-alpine@sha256:3482a20c97e401b56ac50ba8920cc7b5b2022bfc6aa7d4e4c231755770cf892f as build

WORKDIR /app

# Copy only package.json and yarn.lock for build dependencies
COPY ["package.json", "yarn.lock", "./"]

# Install build dependencies
RUN apk --update --no-cache add \
        g++ \
        make \
        python3 \
    && ln -sf python3 /usr/bin/python \
    && apk --no-cache add yarn \
    && apk add --no-cache tini \
    && yarn install --frozen-lockfile

# Runtime stage
FROM node:18-alpine@sha256:3482a20c97e401b56ac50ba8920cc7b5b2022bfc6aa7d4e4c231755770cf892f

WORKDIR /app

# Add a simple init system so that Node would respect process signals
RUN apk --update --no-cache add tini

# Copy only the necessary files, including node_modules from the build stage
COPY --from=build /app/node_modules /app/node_modules
COPY . .

# Set environment variables
ENV NODE_ENV=production \
    NPM_CONFIG_PRODUCTION=false

# Make sure we can write the data directory
RUN mkdir -p data

# Entrypoint and default command
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "main.js"]
