# syntax = docker/dockerfile:1.3

# Always add commit hash for reproducability
FROM node:16.9.1-alpine@sha256:aca897c4ab3de699aa6c5dbf81424de3dfd15f226b7de86b1d30559ccd5d2644

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
