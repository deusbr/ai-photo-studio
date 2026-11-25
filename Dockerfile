FROM node:24-alpine

ENV NODE_ENV=production \
    AI_PHOTO_STUDIO_HOME=/tmp/ai-photo-studio

WORKDIR /app

COPY --chown=node:node package.json index.cjs LICENSE README.md ./
COPY --chown=node:node bin ./bin
COPY --chown=node:node lib ./lib
COPY --chown=node:node skill ./skill

RUN mkdir -p /tmp/ai-photo-studio && chown -R node:node /tmp/ai-photo-studio

USER node

ENTRYPOINT ["node", "bin/mcp-server.cjs"]
