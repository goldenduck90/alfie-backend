FROM node:alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
RUN npm build
COPY . .
ENV PORT 3000
EXPOSE 3000
CMD [ "node", "build/index.js" ]