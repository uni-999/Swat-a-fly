FROM nginx:1.27-alpine

COPY infra/web/nginx.conf /etc/nginx/conf.d/default.conf

WORKDIR /usr/share/nginx/html
COPY index.html style.css script.js ./
COPY favicon.ico snake.ico ./
COPY src ./src
COPY assets ./assets
