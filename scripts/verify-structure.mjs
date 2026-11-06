#!/usr/bin/env node
// Dependency-free checks for release inputs; run --dist after npm run build.
import { readFileSync, statSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = '/TVTest1/';
const failures = [];
let checks = 0;
const read = (file) => readFileSync(resolve(root, file), 'utf8');
function check(label, fn) {
  checks++;
  try { fn(); } catch (error) { failures.push(`${label}: ${error.message}`); }
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function required(file) {
  const info = statSync(resolve(root, file));
  assert(info.isFile() && info.size > 0, `${file}: expected a nonempty file`);
}
const expected = [
  'package.json', 'package-lock.json', 'index.html', 'vite.config.ts',
  'src/main.tsx', 'src/app/App.tsx', 'src/app/routing.ts', 'src/app/storage.ts',
  'src/app/migrateSession.ts', 'src/app/sessionValidation.ts', 'src/app/group/index.ts',
  'src/app/content.ts', 'src/app/components.tsx', 'src/sim/model.ts',
  'src/sim/assessment.ts', 'src/sim/stages.ts',
  'src/scene/ControlRoom.tsx', 'src/scene/buildRoom.ts', 'src/scene/config.ts',
  'src/scene/motion.ts', 'src/figure/ModuleFigure.tsx',
  'src/styles/app.css', 'src/styles/tokens.css',
  'tests/sim/model.test.ts', 'tests/sim/assessment.test.ts', 'tests/app/routing.test.ts', 'tests/app/storage.test.ts', 'tests/group/groupSession.test.ts',
  'tests/scene/scene.test.ts', 'tests/figure/ModuleFigure.test.tsx',
  'README.md', 'COVERAGE.md', 'TASKS.md', 'docs/original_specification.txt',
  'docs/references.md', 'docs/user-guide.md', 'docs/technical-description.md',
  'docs/demo-runbook.md', 'docs/delivery-register.md',
  'anatomy_bshu_prompt_visual_v2.md', 'docs/visual-direction.md',
  'cad/generate_parts.py', 'cad/parts-list.md', 'public/assets/cad/manifest.json',
  '.github/workflows/pages.yml',
];
for (const file of expected) check(file, () => required(file));

check('Vite base', () => {
  assert(/base:\s*['"]\/TVTest1\/['"]/.test(read('vite.config.ts')), `expected base: '${base}'`);
  assert(read('src/scene/ControlRoom.tsx').includes('import.meta.env.BASE_URL'), 'CAD loading must use Vite BASE_URL');
});
check('Five routes', () => {
  const source = read('src/app/routing.ts');
  for (const [route, page] of Object.entries({ overview: 'Overview', console: 'Console', scenarios: 'Scenarios', session: 'Session', help: 'Help' })) {
    assert(source.includes(`'${route}'`), `missing route ${route}`);
    required(`src/app/pages/${page}Page.tsx`);
    assert(read('README.md').includes(`#/${route}`), `README does not document ${route}`);
  }
  assert(!source.includes("'vr'"), 'VR is outside the desktop scope');
});
check('Package and lockfile', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  assert(pkg.name === lock.name && pkg.name === lock.packages[''].name, 'package names disagree');
  for (const script of ['dev', 'test', 'build', 'preview']) assert(pkg.scripts[script], `missing npm script ${script}`);
});
check('Coverage IDs and statuses', () => {
  const rows = read('COVERAGE.md').split('\n').filter((line) => /^\| ТЗ-\d+ \|/.test(line));
  assert(rows.length === 30, `expected 30 requirement rows, found ${rows.length}`);
  for (let n = 1; n <= 30; n++) {
    const id = `ТЗ-${String(n).padStart(2, '0')}`;
    const matching = rows.filter((line) => line.startsWith(`| ${id} |`));
    assert(matching.length === 1, `expected exactly one row ${id}`);
    assert(/\*\*(Реализовано|Частично|Не выполнено|Исключено пользователем)/.test(matching[0]), `${id}: missing explicit status`);
    assert(/\]\([^)]+\)/.test(matching[0]), `${id}: missing evidence link`);
  }
  for (const number of [11, 12, 17, 21, 22, 23, 24, 25]) {
    assert(rows[number - 1].includes('Исключено пользователем'), `ТЗ-${number}: VR exclusion must be explicit`);
  }
  assert(rows[29].includes('45 календарных дней'), 'supply deadline must be retained');
});
for (const doc of ['README.md', 'COVERAGE.md']) check(`Local links in ${doc}`, () => {
  for (const match of read(doc).matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1];
    if (/^(?:https?:|mailto:|#)/.test(target)) continue;
    const file = decodeURIComponent(target.split('#')[0]);
    assert(existsSync(resolve(root, dirname(doc), file)), `broken link ${target}`);
  }
});
check('Safety and documentation', () => {
  assert(read('src/app/content.ts').includes('Учебный прототип · условные данные · не для управления АЭС'), 'missing permanent disclaimer text');
  const readme = read('README.md');
  for (const text of ['localStorage', 'sessionStorage', 'npm ci', 'npm run dev', '--check', 'build123d==0.13.0', '/TVTest1/', 'GitHub Actions']) {
    assert(readme.includes(text), `README missing ${text}`);
  }
});
function verifyCad(directory) {
  const manifest = JSON.parse(read(`${directory}/manifest.json`));
  assert(manifest.units === 'mm' && manifest.sceneScale === 0.005, 'unexpected CAD units or scene scale');
  assert(manifest.parts.length === 3, 'expected exactly three CAD parts');
  const joints = { bezel: 'rigid', knob: 'revolute', 'ack-button': 'linear' };
  for (const [id, joint] of Object.entries(joints)) {
    const matches = manifest.parts.filter((part) => part.id === id);
    assert(matches.length === 1, `expected one ${id} part`);
    const part = matches[0];
    assert(part.file === `${id}.stl` && part.joint.type === joint, `${id}: unexpected filename or joint`);
    const data = readFileSync(resolve(root, directory, part.file));
    assert(data.length >= 84, `${id}: truncated STL header`);
    const triangles = data.readUInt32LE(80);
    assert(triangles === part.triangles && data.length === 84 + 50 * triangles && data.length === part.bytes, `${id}: STL size/count mismatch`);
    assert(triangles > 20 && data.length < 400000, `${id}: mesh budget exceeded or empty geometry`);
    const sha = createHash('sha256').update(data.subarray(80)).digest('hex');
    assert(sha === part.meshSha256, `${id}: geometry checksum mismatch`);
    assert(read('src/scene/config.ts').includes(`assets/cad/${part.file}`), `${id}: missing scene reference`);
  }
  return manifest;
}
check('Committed CAD assets', () => verifyCad('public/assets/cad'));
check('Pages workflow', () => {
  const workflow = read('.github/workflows/pages.yml');
  for (const text of ['branches: [main]', 'workflow_dispatch:', 'npm ci', 'npm test', 'npm run build', 'verify-structure.mjs --dist', 'actions/upload-pages-artifact@', 'path: dist', 'actions/deploy-pages@', 'pages: write', 'id-token: write']) {
    assert(workflow.includes(text), `missing ${text}`);
  }
});
if (process.argv.includes('--dist')) {
  check('Built HTML asset paths', () => {
    const html = read('dist/index.html');
    const urls = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map((match) => match[1]);
    assert(urls.some((url) => url.endsWith('.js')), 'no built JavaScript entry found');
    for (const url of urls) {
      if (url.startsWith('#') || url.startsWith('data:')) continue;
      assert(url.startsWith(base), `built asset must start with ${base}: ${url}`);
      required(`dist/${url.slice(base.length).split('?')[0]}`);
    }
  });
  check('Built CAD assets', () => {
    const built = verifyCad('dist/assets/cad');
    assert(JSON.stringify(built) === JSON.stringify(JSON.parse(read('public/assets/cad/manifest.json'))), 'built CAD manifest differs from source');
  });
}
if (failures.length) {
  console.error(`Structure verification failed (${failures.length}/${checks} checks):\n${failures.map((line) => `  FAIL ${line}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Structure verification passed: ${checks} checks; 5 routes; 30 requirements; 3 CAD assets${process.argv.includes('--dist') ? '; production paths verified' : ''}.`);
}
