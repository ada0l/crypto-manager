FROM node:18-alpine

ARG NODE_ENV=production
ENV NODE_ENV $NODE_ENV

WORKDIR /usr/src/app

RUN yarn global add @nestjs/cli
RUN yarn global add rimraf
COPY package.json ./
COPY yarn.lock ./
RUN yarn install --production=false
COPY . .
RUN yarn run build
