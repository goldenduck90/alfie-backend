FROM node:alpine
WORKDIR /usr/src/app
COPY . ./
RUN npm install
RUN npm build
ENV PORT 3000
EXPOSE 3000
CMD [ "node", "build/index.js" ]