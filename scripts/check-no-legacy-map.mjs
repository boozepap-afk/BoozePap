import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const removedComponent = 'src/components/OpenStreetMap.tsx';
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const dependencyNames = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
};

if (existsSync(removedComponent)) {
  throw new Error(`${removedComponent} must not be restored; checkout uses Google Places Autocomplete.`);
}

for (const dependency of ['react-leaflet', 'leaflet', '@types/leaflet']) {
  if (dependency in dependencyNames) {
    throw new Error(`${dependency} is a legacy draggable-map dependency and must remain removed.`);
  }
}

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:js|jsx|mjs|ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

const legacyImports = sourceFiles('src').filter((path) =>
  /(?:from\s+|import\s*\()['"](?:react-leaflet|leaflet)(?:\/[^'"]*)?['"]/.test(readFileSync(path, 'utf8')),
);

if (legacyImports.length > 0) {
  throw new Error(`Legacy Leaflet imports remain in: ${legacyImports.join(', ')}`);
}

console.log('Legacy OpenStreetMap component, imports, and Leaflet dependencies are absent.');
