FROM node:22-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/src ./src
ENV NODE_ENV=production
EXPOSE 4000
CMD ["npm", "start"]
