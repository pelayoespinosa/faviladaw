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

## Datos de demostración

Los datos de `bbdd-demo/` son **ficticios**: empleados, DNI, NIF, teléfonos, correos,
direcciones, clientes, fichajes, ubicaciones, documentos y direcciones IP (rango de
documentación `203.0.113.x`) están inventados. Nada procede de la base de datos real de
Limpiezas Loló S.L.; solo se reutiliza la estructura de los modelos. Las contraseñas de las
cuentas de demostración son públicas (están en `bbdd-demo/README.md`): no deben usarse en
un servidor accesible desde Internet con datos reales. Los fichajes de demostración
incluyen unos pocos casos de ejemplo de ubicación sin confirmar, fuera de zona y con
sospecha de ubicación falsa, para poder ver cómo se muestran.

## Validación de la ubicación del fichaje

Al fichar entrada o salida, el servidor compara la ubicación del empleado con la del
cliente donde le toca trabajar hoy y guarda el resultado en el propio fichaje
(`validacion`). **Nunca bloquea el fichaje**: lo marca para que una persona lo revise
(registro de jornada, art. 34.9 del Estatuto de los Trabajadores; geolocalización laboral,
art. 90 de la LOPDGDD; sin decisiones automatizadas, art. 22 del RGPD).

### Estados

| Estado | Cuándo |
|---|---|
| `dentro` | La distancia al cliente es menor o igual que su radio. |
| `dudoso` | No se puede afirmar ni negar: la precisión del GPS es mala (más de 100 m, ausente o no válida) o la distancia cae dentro del margen de error (radio + precisión). |
| `fuera` | La distancia supera el radio más la precisión. |
| `sin_referencia` | No hay con qué comparar: no hay turno hoy, el turno es de furgoneta o el cliente no tiene coordenadas. El motivo queda guardado. |

El radio por defecto es de 150 m. Cada cliente puede tener el suyo (`radio_validacion_m`,
entre 20 y 1000 m), que solo edita un administrador desde la gestión de clientes.

### Qué turnos cuentan

- «Hoy» se calcula en hora de Madrid (`Europe/Madrid`), no en la del servidor.
- Se usan los turnos de hoy del empleado, incluidos los de otra persona a la que cubre ese
  día (coberturas). Si hay varios clientes, se toma el más favorable (dentro, luego
  dudoso, luego fuera).
- Un cliente sin coordenadas no se puede validar. La gestión de clientes lo avisa y permite
  filtrarlos.

### Sospecha de ubicación falsa

Una web no puede saber si el móvil usa una ubicación simulada, así que solo hay indicios.
Cada fichaje guarda además un nivel (`ninguna`, `baja` o `alta`) y sus motivos:

| Señal | Se activa cuando |
|---|---|
| `viaje_imposible` | Entre el fichaje anterior y este habría que ir a más de 150 km/h (restando la precisión de ambos puntos y solo si hay más de 1 km). Siempre es sospecha alta. |
| `posicion_antigua` | La marca de tiempo de la posición difiere más de 60 s de la hora del servidor. |
| `coordenadas_identicas` | Las mismas coordenadas, a seis decimales, que en alguno de los 3 puntos anteriores, con precisión inferior a 100 m. |
| `precision_artificial` | Precisión de 0 o 1 m, o exactamente la misma (menos de 10 m) en los 3 puntos anteriores y en este. |

Una señal da sospecha baja; dos o más, o un viaje imposible, sospecha alta.

### Quién ve qué

- El empleado ve en «Fichar» y en «Mis fichajes» el estado de su ubicación. **No ve la
  sospecha**: el servidor la quita de sus respuestas.
- Administración, encargados y gestoría ven la sospecha, pueden filtrar los fichajes fuera
  de zona o sospechosos y consultar un resumen mensual en la ficha del empleado.
- Administración y encargados pueden **justificar** una incidencia con un motivo. El fichaje
  no se modifica: la incidencia sigue constando y se añade la justificación.

### Pruebas

```bash
npm test
```

Ejecuta los tests con el ejecutor integrado de Node (`node:test`), sin dependencias
adicionales ni base de datos: las rutas se prueban con Express y modelos simulados.
