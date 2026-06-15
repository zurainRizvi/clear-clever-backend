const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src', 'ml', 'artifacts');
const destDir = path.join(__dirname, '..', 'dist', 'ml', 'artifacts');

if (!fs.existsSync(srcDir)) {
  console.warn('[copyMlArtifacts] No src/ml/artifacts directory — skipping');
  process.exit(0);
}

function copyArtifactsRecursive(sourceDir: string, destDir: string): void {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyArtifactsRecursive(sourcePath, destPath);
      continue;
    }
    if (entry.name.endsWith('.json')) {
      fs.copyFileSync(sourcePath, destPath);
    }
  }
}

copyArtifactsRecursive(srcDir, destDir);

console.log('[copyMlArtifacts] Copied ML JSON artifacts to dist/ml/artifacts');
