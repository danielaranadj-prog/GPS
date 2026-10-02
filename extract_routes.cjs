const fs = require('fs');
const path = '/Users/danielarana/.gemini/antigravity/brain/414771a9-dd13-44d3-bdcf-ac81ce5fbab0/.system_generated/logs/transcript_full.jsonl';
const lines = fs.readFileSync(path, 'utf-8').split('\n');
let geojsonStr = null;

for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].trim()) continue;
    try {
        const step = JSON.parse(lines[i]);
        if (step.source === 'USER_EXPLICIT' && step.content && step.content.includes('"FeatureCollection"')) {
            const content = step.content;
            const startIndex = content.indexOf('{"type": "FeatureCollection"');
            if (startIndex !== -1) {
                geojsonStr = content.substring(startIndex);
                break;
            }
        }
    } catch(e) {}
}

if (!geojsonStr) {
    console.error('GeoJSON not found in transcript!');
    process.exit(1);
}

const geojson = JSON.parse(geojsonStr);

const groupCategories = {
  2490889419: 'troncal',   // Tepic - Poniente
  2889222760: 'troncal',   // Tepic - Sur
  1874429635: 'alimentadora', // Tepic - Norte
  1199505121: 'troncal',   // Tepic - Vías principales
  2341716171: 'suburbana', // Tepic - Zona Rural
  974833890: 'alimentadora', // Tepic - Progresos
  2398209204: 'alimentadora', // Tepic - Canteras
};

function makeId(title) {
  return 'r-' + title
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const colors = [
  '#2563eb','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899',
  '#14b8a6','#f97316','#06b6d4','#84cc16','#a855f7','#6366f1','#d946ef',
  '#22c55e','#fb923c','#e11d48','#0891b2','#7c3aed','#059669','#dc2626',
  '#9333ea','#ca8a04','#16a34a','#2563eb','#0284c7','#0d9488','#b45309',
];

const routes = geojson.features.map((f, i) => {
  const pts = f.geometry.coordinates;
  const ida = pts.map(p => [p[1], p[0]]); // flip [lng, lat] to [lat, lng]
  const vuelta = [...ida].reverse();
  const cat = groupCategories[f.properties.group] || 'alimentadora';
  const color = f.properties.stroke || colors[i % colors.length];
  
  return {
    id: makeId(f.properties.title || 'ruta'),
    code: f.id ? f.id.toString() : 'R-' + String(i + 1).padStart(2, '0'),
    name: f.properties.title || 'Ruta',
    agency: 'SEMOVI Nayarit',
    category: cat,
    color: color,
    ida: ida,
    vuelta: vuelta,
    notes: f.properties.description || ''
  };
});

fs.writeFileSync('/Users/danielarana/Downloads/GPS/src/data/tepicRoutes.json', JSON.stringify(routes, null, 2));
console.log('✅ Generadas ' + routes.length + ' rutas correctamente.');
