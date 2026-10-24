Proyecto 2ºDAW 
FAVILA - Gestor de empleados, clientes y fichajes por geolocalizacion.

## Origen y autorización

Favila es el Trabajo Fin de Grado de Pelayo Espinosa Tavira (DAW, curso 2026/2027).
Parte del portal de empleados que el autor desarrolló para Limpiezas Loló S.L.; en la
memoria del proyecto se detalla qué módulos son previos, cuáles se han modificado y
cuáles son nuevos.

La empresa autoriza el uso y la publicación de este código con fines académicos, con
la condición de que no se comercialice. Por eso el repositorio se distribuye con una
licencia no comercial (ver `LICENSE`).

## Despliegue con Docker

El servidor se compone de dos contenedores (`api` y `mongo`) definidos en
`docker-compose.yml`. MongoDB solo está en una red interna, sin puertos publicados, y la
API se publica a través de un proxy inverso (nginx-proxy con acme-companion) que
gestiona HTTPS con Let's Encrypt y la ruta `/faviladaw`.

### Requisitos

- Docker con el plugin Compose.
- nginx-proxy y acme-companion en marcha, conectados a una red Docker llamada `proxy`
  (`docker network create proxy` si todavía no existe).

### Pasos

1. Copiar `.env.example` a `.env` y rellenar, como mínimo:
   - `JWT_SECRET`: una cadena larga y aleatoria.
   - `DOMINIO`: el dominio público (por ejemplo `pelayoespinosa.com`).
2. Compilar el cliente, que se genera en `public/`:
   ```bash
   cd client && npm ci && npm run build && cd ..
   ```
3. Levantar los contenedores:
   ```bash
   docker compose up -d --build
   ```
4. (Opcional) Cargar los datos de demostración de `bbdd-demo/`:
   ```bash
   docker compose run --rm -v "$PWD/bbdd-demo:/app/bbdd-demo:ro" api node bbdd-demo/importar.js
   ```

La aplicación queda en `https://<DOMINIO>/faviladaw`. Los documentos subidos se guardan
en el volumen `uploads` y la base de datos en el volumen `mongo-datos`.
