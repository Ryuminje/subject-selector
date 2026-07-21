FROM node:20-slim

WORKDIR /app

# better-sqlite3(Prisma 드라이버 어댑터)가 네이티브 모듈이라 사전 컴파일 바이너리가 없는
# 경우 빌드 도구가 필요합니다.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN yarn install

COPY . .

RUN yarn build

EXPOSE 3000

# 컨테이너 시작 시 DB 마이그레이션을 먼저 적용한 뒤 서버를 띄웁니다.
CMD ["sh", "-c", "npx prisma migrate deploy && yarn start"]
