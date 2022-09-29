FROM node
WORKDIR /usr/src/app
COPY . ./
RUN mkdir ./.husky
RUN npm install
RUN npm run build
ENV PORT 8080
EXPOSE 8080
CMD [ "node", "build/src/index.js" ]