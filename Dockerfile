FROM node:10-slim

ENV NODE_ENV production

WORKDIR /app

ADD package.json /app/package.json

RUN npm install

ADD . /app

ENTRYPOINT [ "bin/tumblr-image-downloader" ]