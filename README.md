# 🚌 Tepic Transit Studio (Mapeador de Paradas y Rutas)

**Tepic Transit Studio** es una Progressive Web App (PWA) de nivel profesional optimizada para **iOS Safari en iPhone** (trabajo de campo con una sola mano en movimiento) y **Escritorio en Mac/PC** (auditoría de calidad y ajuste fino milimétrico sobre la banqueta).

---

## 🚀 Despliegue en GitHub Pages (`www.instantetrips.com/mapper`)

- **Subruta configurada:** `/mapper/` (en [vite.config.ts](file:///Users/danielarana/Downloads/GPS/vite.config.ts), [public/manifest.json](file:///Users/danielarana/Downloads/GPS/public/manifest.json) y [.github/workflows/deploy.yml](file:///Users/danielarana/Downloads/GPS/.github/workflows/deploy.yml)).
- **Despliegue Automático:** Incluido en [.github/workflows/deploy.yml](file:///Users/danielarana/Downloads/GPS/.github/workflows/deploy.yml). Cada `git push origin main` compila automáticamente el proyecto con Node 20 y publica la carpeta `dist/` a GitHub Pages.
- **HTTPS:** Garantiza compatibilidad total con la API de Geolocalización de alta precisión en Safari de iOS.

---

## 🛠️ Stack Tecnológico

- **Framework:** React 18 + Vite 5 + TypeScript + Tailwind CSS.
- **Mapas:** Leaflet 1.9 (Carto Dark Matter, Carto Voyager y OpenStreetMap sin costos ni API keys).
- **Almacenamiento Offline-First:** IndexedDB mediante **Dexie.js** con consultas en tiempo real (`useLiveQuery`). No pierdes datos si se apaga el teléfono o se corta la señal celular.
- **Geocálculo Espacial:** `@turf/turf` (distancia punto a polilínea en metros y cálculo acumulado de desvíos).
- **Audio & Haptic Feedback:** Web Audio API (síntesis de tonos de alta frecuencia) + `navigator.vibrate` para confirmación táctil al marcar paradas en el camión.
- **Screen Wake Lock:** `navigator.wakeLock` con reactivación automática ante cambios de visibilidad en Safari iOS.

---

## 📱 Ergonomía para iPhone (Uso con una sola mano)

1. **Cabecera de Control:**
   - Selector con las **39 rutas oficiales de SEMOVI Tepic** precargadas desde [src/data/tepicRoutes.json](file:///Users/danielarana/Downloads/GPS/src/data/tepicRoutes.json).
   - Botón `+ Nueva Ruta` para trazar nuevas rutas en el municipio de Xalisco.
   - Píldoras de 1 toque para `[ Ida ]` y `[ Vuelta ]`.
   - Chip de lectura GPS en tiempo real: `GPS ±3m` (Verde <5m, Amarillo <15m, Rojo >15m).
   - Botón de Screen Wake Lock para mantener encendida la pantalla del iPhone durante todo el viaje.

2. **Botonera de Pulgar Inferior:**
   - **Botón Gigante:** `📍 Marcar Parada Aquí (GPS)`
     - Captura latitud y longitud con `enableHighAccuracy: true`.
     - Geocodificación inversa automática (Photon & OSM Nominatim) para autocompletar el nombre del cruce de calles (ej. *"Av. México y Victoria"*).
     - Selector rápido de categoría en 1 tap:
       - 🟢 **Oficial** (señalización física o caseta).
       - 🟡 **Costumbre** (esquina donde la gente acostumbra subir/bajar).
       - 🟣 **Base** (terminal o fin de circuito).
     - Botón de deshacer instantáneo si se presionó por error en un bache.
   - **Botón `🔴 Grabar Trayecto GPS`:**
     - Grabación continua de puntos con filtro inteligente (cada 2 segundos o 4 metros) para mapear rutas no oficiales en Xalisco.

---

## ⚠️ Motor Comparador y Auditor (SEMOVI vs. Realidad de Calle)

- Calcula en tiempo real si el camión se aleja más de **45 metros** del trazo oficial registrado por SEMOVI.
- Si detecta un desvío (cambio de calle o ingreso a una nueva colonia), resalta ese tramo en **rojo brillante** y despliega el banner de alerta:
  `⚠️ Desvío de ruta detectado (+650m fuera del trazo oficial de SEMOVI)`.
- Permite con 1 toque:
  - **Aceptar trazo 2026:** Reemplaza la geometría vieja por la recorrida en la calle.
  - **Guardar como Ramal / Variante:** Conserva ambas geometrías (ej. *"Río Suchiate - Cantera"*).

---

## 💻 Modo Editor de Escritorio (Control de Calidad Mac/PC)

- **Edición sobre el mapa:** Pines arrastrables para acomodar con precisión milimétrica las paradas sobre la banqueta.
- **Lista Cronológica de Paradas:** Panel lateral con las paradas ordenadas por secuencia (`#1, #2, #3...`), botones de subir/bajar orden, edición de nombre y eliminación.
- **Modo Simulación Integrado:** Botón `Simular` en la cabecera para reproducir en escritorio una prueba de campo en Tepic con desvío de +650m y probar la auditoría sin salir de casa.

---

## 📤 Exportador Oficial de Datos para Tepic Transit

Exporta en formato JSON estandarizado requerido por la app móvil:

```json
{
  "cityId": "tepic",
  "stops": [
    {
      "id": "stop-suchiate-mexico-victoria",
      "name": "Av. México y Victoria",
      "coordinates": { "lat": 21.5034, "lng": -104.8912 },
      "type": "costumbre",
      "routeIds": ["r-o-suchiate"],
      "direction": "ida",
      "sequence": 1
    }
  ]
}
```

Incluye función de **Copiar al Portapapeles**, **Descargar archivo `.json`** e **Importar JSON** para restaurar trabajos de campo previos.

---

## 🧪 Comandos de Desarrollo

```bash
# Iniciar servidor de desarrollo en http://localhost:3000/mapper/
npm run dev

# Compilar para producción (TypeScript + Vite)
npm run build

# Previsualizar el build de producción
npm run preview
```
