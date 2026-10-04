const fs = require('fs');
const path = '/Users/danielarana/Downloads/GPS/src/App.tsx';
let code = fs.readFileSync(path, 'utf8');

// Add mappingMode state
code = code.replace(
  "const [isDesktopMode, setIsDesktopMode] = useState(false);",
  "const [isDesktopMode, setIsDesktopMode] = useState(false);\n  const [mappingMode, setMappingMode] = useState<'zone' | 'route'>('zone');"
);

// We need to pass mappingMode to Header and FieldControls
// Wait, first let's see Header props.
