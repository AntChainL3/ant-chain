FROM caddy:2.8.4-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY . /srv/
RUN rm -f /srv/Dockerfile /srv/Caddyfile /srv/.dockerignore /srv/.railwayignore
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
