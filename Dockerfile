# syntax = docker/dockerfile:1.3

# Always add commit hash for reproducability
FROM node:14.18.1-alpine@sha256:557f00fb5d780597b0e7bcdc6d93abeb7e73599bcbfeba5832dc5646a8d3f120

# Enable prod optimizations
ENV NODE_ENV=production

WORKDIR /usr/src/app

COPY ["package.json", "package-lock.json*", "./"]
RUN npm ci --only=production

COPY --chown=node:node . /usr/src/app

# Add a simple init system so that Node would respect process signals
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]

# Don't run as root
USER node
CMD ["node", "main.js" ]
