# Editor de lugares · PorDóndePasa

## Uso

1. Abre **Lugares** y pulsa **Nuevo**.
2. Toca el mapa y arrastra el pin a la entrada. También puedes pedir una lectura GPS reciente; una precisión peor de 30 m requiere ajustar el pin o volver a localizar.
3. Completa nombre y tipo. Añade nombres populares separados por comas, colonia, municipio y referencia de acceso.
4. Guarda. Al mover el punto vuelve a quedar pendiente de revisión. Un pin manual no conserva una precisión GPS que ya no le corresponde.
5. Usa **Exportar GeoJSON** para respaldar todos los lugares guardados. Importa ese archivo en otro navegador o dispositivo; revisa el resumen y decide si actualizar IDs ya existentes.

Los registros se guardan en IndexedDB de este navegador y origen. No existe sincronización automática entre teléfono, computadora, localhost y sitio publicado. Borrar datos del navegador puede eliminar el catálogo. Exportar no publica automáticamente los destinos en PorDóndePasa.

## Formato

Archivo `pordondepasa-lugares.geojson`: FeatureCollection con `dataset: pordondepasa-places`, `schemaVersion: 1`, `exportedAt` y puntos `[longitud, latitud]`.

Cada Feature lleva `id`, `name`, `category`, `aliases`, `neighborhood`, `municipality`, `entrance`, `status`, `captureMethod`, fechas `createdAt`/`updatedAt`, y opcionalmente `accuracy`/`capturedAt`. `geometry.coordinates` es el punto de acceso, no el centro de un edificio. Los IDs se conservan al editar y al exportar/importar. No se mezclan registros de paradas ni se ajustan puntos a trazos de camiones.

Importación: hasta 10 MB y 10 000 registros; valida el archivo completo antes de abrir una transacción. Rechaza coordenadas, fechas, categorías o IDs duplicados inválidos. Conserva los existentes por defecto; actualizarlos requiere seleccionar la opción explícita. No elimina otros registros. La primera versión admite el formato propio exportado; no convierte automáticamente cualquier GeoJSON externo.

## Conservación y cambios

- Respaldo previo, incluidos cambios locales sin commit: `/private/tmp/GPS-before-places-20261008.tar.gz`. No contiene node_modules, .git ni dist.
- Migración Dexie 5 → 6 agrega sólo `places`, preservando stores previos.
- Se eliminó la limpieza de rutas personalizadas y de La Yerba al iniciar. La carga de rutas predeterminadas añade las que faltan, sin sobrescribir trazos editados ya guardados.
- Panel y mapa de lugares independientes del editor de paradas/rutas; no se modificó PorDondePasa ni su algoritmo. El selector reutiliza la capa visual de Google del editor existente y ofrece OpenStreetMap como alternativa. La capa Google usa el endpoint de teselas preexistente, no una integración oficial Maps JavaScript/Places; su disponibilidad no está garantizada. No entrega metadatos de negocios. No se extraen fichas ni se descarga contenido masivamente.
- No se publicó ni se hizo push. Los cambios que ya estaban en el proyecto se conservaron.

## Verificación

`npm run build` y `node --experimental-strip-types tests/places.test.ts`.

Prueba aislada en IndexedDB: migrar base v5 con ruta/parada/trazo, comprobar conservación, guardar/reabrir lugar e importar el mismo ID actualizado sin duplicarlo. La base y página temporales se retiraron tras la prueba.

Revisión de interfaz: abrir pestaña, completar nombre y categoría, colocar y arrastrar pin, aviso de cambios sin guardar y descarte del borrador. No se dejaron lugares ficticios en el catálogo. El GPS físico requiere comprobación en teléfono con permiso de ubicación.
