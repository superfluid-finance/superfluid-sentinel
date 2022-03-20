# syntax = docker/dockerfile:1.3

# Always add commit hash for reproducability
FROM node:14-alpine@sha256:7bcf853eeb97a25465cb385b015606c22e926f548cbd117f85b7196df8aa0d29

# Enable prod optimizations
ENV NODE_ENV=production

WORKDIR /app
RUN apk add --update --no-cache g++ make python3 && ln -sf python3 /usr/bin/python

COPY ["package.json", "package-lock.json*", "./"]
RUN npm ci --only=production
COPY . /app

RUN mkdir data
RUN chown node:node data

# Add a simple init system so that Node would respect process signals
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]

# Don't run as root
USER node
CMD ["node", "main.js" ]
