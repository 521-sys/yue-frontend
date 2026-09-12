# 前端 Nginx 镜像：仅拷贝静态 dist；nginx.conf 通过 docker-compose 卷挂载（见 docker-compose.yml）
FROM nginx:1.27-alpine AS runtime

COPY dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
