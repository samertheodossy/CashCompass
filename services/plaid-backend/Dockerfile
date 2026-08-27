FROM node:22-slim
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
USER node
CMD ["node", "src/index.js"]
