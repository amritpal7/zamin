FROM node:20-alpine

# Expo CLI needs these
RUN apk add --no-cache git bash

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 8081 19000 19001

CMD ["npx", "expo", "start", "--port", "8081"]
