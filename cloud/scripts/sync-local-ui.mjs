import { cpSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const folder of ['src', 'shared', 'public']) cpSync(path.join(root, '..', folder), path.join(root, folder), { recursive: true });
rmSync(path.join(root, 'src/main.tsx'), { force: true });
