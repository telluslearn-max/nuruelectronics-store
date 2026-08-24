# No dependencies to install — pure Node built-ins (http, https, crypto). Smaller and simpler
# than the market-watcher image, and this one runs request-driven (no min-instances needed),
# since it doesn't hold any persistent connection the way the watcher's WebSocket does.
FROM node:20-alpine

WORKDIR /app
COPY package.json ./
COPY index.mjs ./

CMD ["node", "index.mjs"]
