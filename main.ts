import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repository = dirname(fileURLToPath(import.meta.url));
const output = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');
const gameSource = resolve(repository, 'game');
const imageSource = resolve(repository, 'screenshots');
const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function inside(parent, child) {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}

function inspectTree(root) {
  const entries = [];
  const stack = [''];
  while (stack.length) {
    const prefix = stack.pop();
    const directory = prefix ? resolve(root, prefix) : root;
    const names = readdirSync(directory).sort();
    for (const name of names) {
      const rel = prefix ? `${prefix}/${name}` : name;
      const path = resolve(root, rel);
      const st = lstatSync(path);
      if (st.isSymbolicLink()) throw new Error(`Refusing symbolic link: ${path}`);
      if (st.isDirectory()) { entries.push({ path: rel, directory: true, bytes: 0 }); stack.push(rel); }
      else if (st.isFile()) entries.push({ path: rel, directory: false, bytes: st.size });
      else throw new Error(`Refusing special file: ${path}`);
    }
  }
  return entries.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}

function removeOutput(path) {
  if (!existsSync(path)) return;
  const st = lstatSync(path);
  if (st.isSymbolicLink() || (!st.isDirectory() && !st.isFile())) throw new Error(`Refusing unsafe output entry: ${path}`);
  rmSync(path, { recursive: st.isDirectory(), force: false });
}

if (output === repository || inside(gameSource, output) || inside(imageSource, output) || inside(output, repository)) {
  throw new Error(`MAKEFUN_OUTPUT_DIR overlaps the repository inputs: ${output}`);
}
const gameEntries = inspectTree(gameSource);
const imageEntries = inspectTree(imageSource);
if (!gameEntries.some((entry) => entry.path === 'index.html' && !entry.directory)) throw new Error('game/index.html is required');
const images = imageEntries.filter((entry) => !entry.directory && /\.(png|jpe?g)$/i.test(entry.path));
if (images.length < 3 || images.length > 4 || images.some((entry) => entry.bytes > caps.screenshots.max_bytes)) {
  throw new Error('screenshots/ must contain three or four PNG/JPEG images within the byte cap');
}

mkdirSync(output, { recursive: true });
for (const name of ['game', 'screenshots', 'dossier.json']) removeOutput(resolve(output, name));
cpSync(gameSource, resolve(output, 'game'), { recursive: true, force: false, errorOnExist: true });
cpSync(imageSource, resolve(output, 'screenshots'), { recursive: true, force: false, errorOnExist: true });
const dossier = buildDossier(output, caps);
writeFileSync(resolve(output, 'dossier.json'), dossier);

const outputGameEntries = inspectTree(resolve(output, 'game')).filter((entry) => !entry.directory);
const gameBytes = outputGameEntries.reduce((sum, entry) => sum + entry.bytes, 0);
const screenshotNames = images.map((entry) => entry.path).sort();
const dossierBytes = statSync(resolve(output, 'dossier.json')).size;
console.log(`KESTREL REACH hand-in: ${outputGameEntries.length} game files, ${gameBytes} bytes.`);
console.log(`Screenshots (${screenshotNames.length}): ${screenshotNames.join(', ')}`);
console.log(`dossier.json: ${dossierBytes} bytes.`);
