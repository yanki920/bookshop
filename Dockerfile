# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5
WORKDIR /app
COPY deployment/requirements.txt /tmp/requirements.txt
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export SSL_CERT_FILE=/run/secrets/proxy_ca PIP_CERT=/run/secrets/proxy_ca; apt-get -o Acquire::https::CaInfo=/run/secrets/proxy_ca update; else apt-get update; fi \
    && apt-get install -y --no-install-recommends python3 python3-venv tesseract-ocr gosu ca-certificates \
    && python3 -m venv /opt/ocr \
    && /opt/ocr/bin/pip install --no-cache-dir -r /tmp/requirements.txt \
    && rm -rf /var/lib/apt/lists/* /tmp/requirements.txt
ENV PATH="/opt/ocr/bin:$PATH" HOST=0.0.0.0 NODE_ENV=production BOOKSHOP_DATA_DIR=/var/data/bookshop BOOKSHOP_BACKUP_DIR=/var/data/backups BOOKSHOP_SEED_SAMPLES=0
COPY . /app
RUN chmod -R a+rX /app && chmod +x /app/deployment/entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["/app/deployment/entrypoint.sh"]
CMD ["node", "server.mjs"]
