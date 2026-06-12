FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY nest-cli.json tsconfig*.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src

RUN npx prisma generate --schema=prisma/schema.prisma
RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --omit=dev

COPY prisma.config.ts ./
COPY prisma ./prisma
RUN npx prisma generate --schema=prisma/schema.prisma

COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push --schema=prisma/schema.prisma && node dist/src/main"]
