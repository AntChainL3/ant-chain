FROM caddy:2.8.4-alpine
COPY Caddyfile /etc/caddy/Caddyfile
# Copy only the site's own files, folder by folder, so nothing else in the build context can end up in the image.
COPY index.html robots.txt sitemap.xml app.css docs.css explorer.css walletkit.css icon.png apple-touch-icon.png og.png /srv/
COPY css/ /srv/css/
COPY js/ /srv/js/
COPY bridge/ /srv/bridge/
COPY docs/ /srv/docs/
COPY explorer/ /srv/explorer/
COPY launch/ /srv/launch/
COPY roadmap/ /srv/roadmap/
COPY stake/ /srv/stake/
COPY swap/ /srv/swap/
# Run as an unprivileged user; Caddy listens on $PORT (8080 by default), so it needs no root.
RUN addgroup -S web && adduser -S -G web web && chown -R web:web /data /config
USER web
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
