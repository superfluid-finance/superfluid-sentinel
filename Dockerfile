# syntax = docker/dockerfile:1.3

# Always add commit hash for reproducability
FROM node:18-alpine@sha256:3482a20c97e401b56ac50ba8920cc7b5b2022bfc6aa7d4e4c231755770cf892f

# Enable prod optimizations
ENV NODE_ENV=production

WORKDIR /app
RUN apk add --update --no-cache g++ make python3 && \
    ln -sf python3 /usr/bin/python && \
    apk add --update --no-cache yarn

COPY ["package.json", "yarn.lock", "./"]
RUN yarn install --frozen-lockfile --production
COPY . /app

RUN mkdir data
RUN chown node:node data

# Add a simple init system so that Node would respect process signals
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]

# Don't run as root
USER node
CMD ["node", "main.js" ]
