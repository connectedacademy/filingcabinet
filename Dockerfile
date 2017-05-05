FROM node:7-alpine
MAINTAINER Tom Bartindale <tom@bartindale.com>

RUN apk --no-cache add git

RUN npm install --silent -g nodemon

RUN mkdir -p /usr/src/app

WORKDIR /usr/src/app

COPY package.json /usr/src/app/package.json

RUN npm install --silent && npm cache clean

COPY . /usr/src/app

EXPOSE 1337

CMD node --harmony-async-await app.js
