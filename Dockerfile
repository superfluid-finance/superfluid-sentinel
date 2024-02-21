FROM node:18-alpine@sha256:3482a20c97e401b56ac50ba8920cc7b5b2022bfc6aa7d4e4c231755770cf892f

# Set environment variables
ENV NODE_ENV=production

# Create app directory
WORKDIR /app

# Install dependencies
RUN apk add --update --no-cache \
        yarn \
        tini

# Copy package.json and yarn.lock
COPY package.json yarn.lock ./

# Install app dependencies
RUN yarn install --production

# Copy the rest of the application
COPY . ./

# make sure we can write the data directory
RUN chown -R node:node /app/data \
    && chmod -R 755 /app/data

# Use tini as the entrypoint
ENTRYPOINT ["/sbin/tini", "--"]

# Don't run as root
USER node

# Start the application
CMD ["node", "main.js"]
