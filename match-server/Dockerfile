FROM node:20-alpine

WORKDIR /app

COPY match-server/package.json ./package.json
RUN npm install --omit=dev

COPY match-server/src ./src
COPY src/game ./shared-game

EXPOSE 2567

CMD ["npm", "start"]
