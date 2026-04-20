FROM python:3.12-slim

# Paquetes útiles para scripts típicos de MAX
RUN pip install --no-cache-dir \
    numpy==2.2.* \
    pandas==2.2.* \
    requests==2.32.*

WORKDIR /sandbox

# Sin root
USER nobody
