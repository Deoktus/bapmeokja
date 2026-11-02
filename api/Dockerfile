FROM node:24-alpine

ENV NODE_ENV=production
WORKDIR /app

# 의존성을 먼저 설치해 소스만 바뀔 때 이 층을 다시 쓴다
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY src ./src

# 실행에는 필요 없는 패키지 관리자(npm·yarn·corepack)를 지워 취약점과 공격 대상을 줄인다
RUN rm -rf /usr/local/lib/node_modules /opt/yarn-* \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
    /usr/local/bin/yarn /usr/local/bin/yarnpkg

# 루트가 아닌 기본 제공 사용자로 실행한다
USER node
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "src/server.js"]
