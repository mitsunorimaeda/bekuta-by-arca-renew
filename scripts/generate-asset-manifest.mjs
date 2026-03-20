// scripts/generate-asset-manifest.mjs
// ビルド後に dist/assets/ 内の全ファイルリストを生成
import { readdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const distDir = join(process.cwd(), 'dist');
const assetsDir = join(distDir, 'assets');

try {
  const files = readdirSync(assetsDir)
    .filter((f) => f.endsWith('.js') || f.endsWith('.css'))
    .map((f) => `/assets/${f}`);

  const manifest = { assets: files, generated: new Date().toISOString() };
  writeFileSync(join(distDir, 'asset-manifest.json'), JSON.stringify(manifest));
  console.log(`[asset-manifest] Generated with ${files.length} assets`);
} catch (err) {
  console.error('[asset-manifest] Failed:', err.message);
  process.exit(1);
}
