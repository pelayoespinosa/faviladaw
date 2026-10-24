FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

# public/ (cliente compilado) y uploads/ se montan como volúmenes
RUN mkdir -p public uploads && chown -R node:node /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

USER node
EXPOSE 3000

CMD ["node", "src/app.js"]
