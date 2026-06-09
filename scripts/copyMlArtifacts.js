const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src', 'ml', 'artifacts');
const destDir = path.join(__dirname, '..', 'dist', 'ml', 'artifacts');

if (!fs.existsSync(srcDir)) {
  console.warn('[copyMlArtifacts] No src/ml/artifacts directory — skipping');
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });

for (const file of fs.readdirSync(srcDir)) {
  if (!file.endsWith('.json')) {
    continue;
  }
  fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
}

console.log('[copyMlArtifacts] Copied ML JSON artifacts to dist/ml/artifacts');
