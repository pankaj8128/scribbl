FROM node:26-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install && npm cache clean --force
COPY . .
CMD ["npm", "start"]
EXPOSE 3000
