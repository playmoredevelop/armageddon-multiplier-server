FROM node:16-alpine

ARG _SERVER_PORT='8080'
ARG _FRONTEND_HOST='http://localhost:8081'
ARG _BACKEND_HOST='https://localhost:8080'
ARG _REDIS_HOST='0.0.0.0'
ARG _REDIS_PORT='6379'

RUN apk update

WORKDIR /app
COPY package.json ./
COPY tsconfig.json ./
RUN npm i -fSD --no-shrinkwrap --no-package-lock --no-audit --no-fund

ENV SERVER_ROUND_TIME_SEC='30'
ENV SERVER_BIRDS_CHUNK='10'
ENV SERVER_TEST_SESSION='false'
ENV SERVER_PORT=$_SERVER_PORT
ENV FRONTEND_HOST=$_FRONTEND_HOST
ENV BACKEND_HOST=$_BACKEND_HOST
ENV REDIS_HOST=$_REDIS_HOST='0.0.0.0'
ENV REDIS_PORT=$_REDIS_PORT='6379'

EXPOSE $_SERVER_PORT

COPY . .
RUN npx tsc -p ./tsconfig.json

CMD ["node", "--es-module-specifier-resolution=node", "./build/multiplier.js"]
