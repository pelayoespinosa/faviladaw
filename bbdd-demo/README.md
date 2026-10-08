# Datos de demostración

Datos **inventados** (nada procede de la base de datos real; solo se reutiliza la estructura de los modelos).
Las fechas de turnos, fichajes y coberturas son relativas al día en que se genera.

| Archivo | Contenido |
|---|---|
| `empleados.json` | 50 empleados: 1 director (Pelayo Espinosa Tavira), 1 administrativo, 3 encargados, 3 conductores, 4 peones y 38 limpiadores. Jornadas de 38,5 h (19 personas), 20 h (13), 30 h, 25 h, 35 h, 15 h, 12,5 h y 40 h. Repartidos por 6 zonas de Asturias |
| `usuarios.json` | 51 cuentas: una por empleado (patrón nombre + iniciales de apellidos, p. ej. `pelayoet`) y la cuenta `gestoria` |
| `clientes.json` | 200 clientes de 20 concejos de Asturias. Sus **horas contratadas y su facturación mensual salen de los turnos** |
| `turnos.json` | 337 turnos: limpieza semanal en clientes, servicios periódicos (cristales mensual/bimestral/trimestral, abrillantados trimestral/cuatrimestral/semestral/anual, limpieza mecanizada, garajes y portales con distintas frecuencias) y rutas de furgoneta |
| `furgonetas.json` | 3 furgonetas con su conductor |
| `ausencias.json` | vacaciones (verano, Semana Santa, Navidad, puentes…) y bajas (terminadas y en curso) de 2026 |
| `coberturas.json` | sustituciones de las ausencias (algunas quedan «sin cubrir» a propósito) |
| `fichajes.json` | unas 7 semanas de fichajes con ubicación, incluidos los de quien sustituye, alguno añadido a mano, corregido o anulado |
| `cuadros_laborales.json` | cuadros de enero a septiembre de 2026 (sin y con variaciones), generados con la propia lógica de la aplicación y con observaciones de vacaciones/bajas y pluses |
| `precios_servicio.json` | precio por hora de los 15 servicios (limpieza, cristales, abrillantado, mecanizada…). Con ellos y las horas de los turnos, la aplicación calcula sola la facturación mensual de cada cliente |
| `documentos.json`, `carpetas.json`, `documentos/` | 6 documentos de prueba con PDF (términos y condiciones, protección de datos, prevención de riesgos, normas de furgonetas, calendario laboral, guía para fichar), con quién los ha confirmado ya |
| `productos.json` | 40 productos de limpieza con precio |
| `solicitudes.json` | 20 pedidos de material de los empleados |

## Cómo cuadra todo

- Cada empleado tiene tantas horas de turno (prorrateadas por frecuencia) como su contrato (desvío máximo 0,45 h/semana).
- Las horas contratadas de cada cliente = suma de sus turnos, por tipo de tarea y frecuencia.
- La facturación mensual no se guarda: la aplicación la calcula = Σ horas al mes de cada turno (prorrateadas por frecuencia sobre un año de 52 semanas) × precio por hora del servicio (`precios_servicio.json`).

## Cuentas

Contraseña de todas: `Baliza2026`, salvo `pelayoet` (admin, director), que entra con `pruebafavila`. `pelayoet` es admin, `gestoria` es gestoría, los encargados y el administrativo tienen rol encargado y el resto empleado.

## Uso

```bash
node datos-demo/importar.js        # carga los JSON en la base del .env (borra esas colecciones)
node datos-demo/generar-todo.js    # regenera todos los JSON (necesita MongoDB en marcha)
```

`generar-todo.js` ejecuta en orden `generar.js` (empleados, cuentas, clientes), `generar-operativa.js` (turnos, ausencias, coberturas, fichajes, productos…) y `generar-cuadros.js` (arranca el servidor contra una base temporal y genera los cuadros mes a mes).

## Detalles de esta versión

- **Ctto (tipo de contrato)** en cada empleado, según su jornada: tiempo completo → `100` (indefinido), `189` (indefinido, conversión), `501`/`410` (eventual / interinidad); tiempo parcial → `200` (indefinido), `289` (indefinido, conversión), `510` (interinidad), `502` (eventual), `402` (obra o servicio). Es el código que sale en el cuadro laboral.
- **Conducción**: los 3 conductores llevan la furgoneta solo 5 o 7,5 h a la semana (turno sin días ni horario); el resto de su jornada son turnos de limpieza en clientes.
- **Vacaciones y bajas**: todas están cubiertas (sustituciones día a día, sin solapes ni sustitutos de vacaciones). Las vacaciones de verano se escalonan por semanas.
- **Avisos de ejemplo** (a propósito): dos empleados se pasan de su jornada de contrato en el horario base, `Faes Viña, Rosa` (+2,5 h) y `Collado Pérez, Manuel` (+3 h). Todos los demás cuadran con su contrato.
