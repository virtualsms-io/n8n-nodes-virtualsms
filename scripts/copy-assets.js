// Copies node icons (.svg/.png) from package-root nodes/ into dist/nodes/ so n8n loads them from the published package.
const fs = require("fs");
const path = require("path");

const pkgRoot = path.join(__dirname, "..");
const distRoot = path.join(pkgRoot, "dist");

// Source directories that contain assets to mirror into dist
const sourceDirs = ["nodes", "credentials"];

function walk(dir, srcRootForRel) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, srcRootForRel);
    } else if (entry.name.endsWith(".svg") || entry.name.endsWith(".png")) {
      // Compute path relative to pkg root (so "nodes/X/icon.svg" preserves)
      const rel = path.relative(pkgRoot, full);
      const dest = path.join(distRoot, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(full, dest);
      console.log(`copied ${rel}`);
    }
  }
}

for (const dir of sourceDirs) {
  walk(path.join(pkgRoot, dir), pkgRoot);
}
