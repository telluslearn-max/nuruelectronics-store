# Minimal image for a small always-on Node process — no build step, no framework,
# just the one dependency (ws). Alpine keeps the image (and therefore cold-start /
# storage cost) small, which matters more here than for a request-served function
# since this container is meant to stay running rather than scale to zero.
FROM node:20-alpine

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY index.mjs ./

CMD ["node", "index.mjs"]
