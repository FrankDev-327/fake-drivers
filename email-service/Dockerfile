FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# pnpm version comes from "packageManager" in package.json
RUN corepack enable
WORKDIR /app

FROM base AS builder
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM base AS production
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile
# orm.ts and logger.ts live at the project root, so nest builds into dist/src
COPY --from=builder /app/dist ./dist
RUN mkdir -p /logs && chown node:node /logs
USER node
CMD ["node", "dist/src/main.js"]
