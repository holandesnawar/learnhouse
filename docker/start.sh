#!/bin/sh

# Arranque del contenedor de la escuela.
#
# Todo lo que se levanta aquí va bajo pm2 —incluido nginx— para que, si algo
# se cae, se vuelva a levantar solo en vez de dejar la escuela a medias:
# antes, si nginx moría, el contenedor seguía "vivo" pero no servía nada.

# Set environment variables for proper Python logging
export PYTHONUNBUFFERED=1
export PYTHONIOENCODING=utf-8

# Reinicio con espera creciente: si un proceso está fallando (por ejemplo la
# base todavía no responde), no lo reintenta 50 veces por segundo.
PM2_RESTART="--restart-delay 3000 --max-restarts 10000 --time"

# Wait for database and redis if connection strings point to external services
# (In docker-compose, depends_on handles this, but useful for standalone)
if [ -n "$LEARNHOUSE_SQL_CONNECTION_STRING" ]; then
    DB_HOST=$(echo "$LEARNHOUSE_SQL_CONNECTION_STRING" | sed -n 's/.*@\([^:]*\):\([0-9]*\)\/.*/\1/p')
    if [ -n "$DB_HOST" ] && [ "$DB_HOST" != "localhost" ] && [ "$DB_HOST" != "127.0.0.1" ] && [ "$DB_HOST" != "db" ]; then
        echo "Waiting for external database at $DB_HOST..."
        timeout 60 sh -c 'until nc -z '"$DB_HOST"' 5432; do sleep 1; done' || true
    fi
fi

# Start the services
# Use server-wrapper.js for runtime environment variable injection
pm2 start server-wrapper.js --cwd /app/web --name learnhouse-web $PM2_RESTART > /dev/null 2>&1
pm2 start uv --cwd /app/api --name learnhouse-api $PM2_RESTART -- run app.py
pm2 start node --cwd /app/collab --name learnhouse-collab $PM2_RESTART -- dist/index.js

# nginx es la puerta de entrada: si muere, no entra nadie. Va también bajo pm2
# para que se levante solo. Si por lo que sea pm2 no puede con él, se arranca
# a mano — nunca dejamos el contenedor sin puerta.
NGINX_BIN=$(command -v nginx || echo /usr/sbin/nginx)
pm2 start "$NGINX_BIN" --name learnhouse-nginx --interpreter none $PM2_RESTART -- -g "daemon off;" || true

# Comprobación de verdad: pm2 devuelve 0 aunque el proceso se caiga al
# segundo. Miramos si nginx está escuchando de verdad y, si no, lo arrancamos
# a mano. Sin puerta no hay escuela, así que aquí no vale confiarse.
sleep 3
if ! nc -z 127.0.0.1 80 2>/dev/null; then
    echo "nginx no responde en el puerto 80 — se arranca directamente"
    pm2 delete learnhouse-nginx > /dev/null 2>&1 || true
    nginx -g 'daemon off;' &
else
    echo "nginx en pie bajo pm2"
fi

# Check if the services are running and log the status
pm2 status

# Tail PM2 logs with proper formatting
pm2 logs --raw
