# 1단계: 빌드 (이 층은 최종 이미지에 들어가지 않는다)
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# 2단계: 빌드 결과만 담아 루트가 아닌 Nginx로 서비스한다
FROM nginxinc/nginx-unprivileged:stable-alpine
# 기본 이미지에 남아 있는 수정 가능한 취약점을 패키지 업데이트로 해결한다 (끝나면 다시 비루트로 돌아간다)
USER root
RUN apk upgrade --no-cache
USER nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
