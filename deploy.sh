#!/bin/bash

# ==============================================================================
# 자동 배포 스크립트 (Deploy to NAS)
# ==============================================================================

NAS_USER="fbalswp"
NAS_IP="192.168.0.21"
NAS_DEST="~/docker/my-webapp"

echo "🚀 배포를 시작합니다..."
echo "📦 NAS 서버($NAS_IP)로 프로젝트 파일 전송 중..."

# node_modules와 .git, .next 등 불필요한 폴더를 제외하고 전송 (rsync 사용)
rsync -avz --exclude="node_modules" --exclude=".git" --exclude=".next" ./ $NAS_USER@$NAS_IP:$NAS_DEST/

if [ $? -ne 0 ]; then
    echo "❌ 파일 전송에 실패했습니다."
    exit 1
fi

echo "✅ 파일 전송 완료!"
echo "🔄 NAS 서버에서 Docker 컨테이너 재빌드 및 실행 중..."

ssh -t $NAS_USER@$NAS_IP "cd $NAS_DEST && sudo docker compose up -d --build"

if [ $? -ne 0 ]; then
    echo "❌ Docker 배포에 실패했습니다."
    exit 1
fi

echo "🎉 배포가 성공적으로 완료되었습니다!"
