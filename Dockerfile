FROM node:12.16.3-alpine

WORKDIR /usr/src/app

ARG GITHUB_TOKEN

COPY . .

# add build tools
RUN apk add --no-cache alpine-sdk python

# install npm dependencies
RUN GITHUB_TOKEN=$GITHUB_TOKEN npm ci
# avoid GITHUB_TOKEN dependency when running
RUN rm -f .npmrc

# run lint
RUN npm run lint

# cleanup build tools
RUN apk del alpine-sdk python

CMD npm run start
