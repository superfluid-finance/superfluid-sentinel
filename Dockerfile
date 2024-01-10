# syntax = docker/dockerfile:1.3

# Always add commit hash for reproducibility
FROM node:18-alpine@sha256:3482a20c97e401b56ac50ba8920cc7b5b2022bfc6aa7d4e4c231755770cf892f

# Enable prod optimizations
ENV NODE_ENV=production \
    NPM_CONFIG_PRODUCTION=false

WORKDIR /app

# Install build dependencies and clean up
RUN apk add --update --no-cache \
        g++ \
        make \
        python3 \
    && ln -sf python3 /usr/bin/python \
    && apk add --update --no-cache yarn \
    && apk add --no-cache tini \
    && rm -rf /var/cache/apk/*

# Copy package.json and yarn.lock for optimised caching
COPY ["package.json", "yarn.lock", "./"]

# Make sure we can write the data directory
RUN mkdir -p data

# Install application dependencies
RUN yarn install

ENTRYPOINT ["/sbin/tini", "--"]

CMD ["node", "main.js"]
