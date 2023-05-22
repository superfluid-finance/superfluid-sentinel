# syntax = docker/dockerfile:1.3

# Always add commit hash for reproducability
FROM node:16-alpine@sha256:43b162893518666b4a08d95dae49153f22a5dba85c229f8b0b8113b609000bc2

# Enable prod optimizations
ENV NODE_ENV=production

WORKDIR /app
RUN apk add --update --no-cache g++ make python3 && ln -sf python3 /usr/bin/python

COPY ["package.json", "package-lock.json*", "./"]
RUN npm ci --only=production
COPY . /app

RUN mkdir data

# Add a simple init system so that Node would respect process signals
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]

CMD ["node", "main.js" ]