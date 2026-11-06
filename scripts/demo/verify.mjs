import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const ffmpeg = process.env.DEMO_FFMPEG ?? '/Applications/identityproxy.app/Contents/Resources/ffmpeg/macos/aarch64/ffmpeg'
const media = join(root, 'public/media')
const names = ['tvtest1-demo.mp4', 'tvtest1-demo-poster.jpg', 'tvtest1-demo.ru.vtt']
const mode = process.argv[2] ?? 'media'

function run(program, args) {
  const result = spawnSync(program, args, { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
  if (result.status !== 0) throw new Error(`${program} ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`)
  return `${result.stdout}\n${result.stderr}`
}

function verifyMedia() {
  for (const name of names) assert.ok(existsSync(join(media, name)), `Missing ${name}`)
  const video = join(media, names[0])
  const bytes = statSync(video).size
  assert.ok(bytes > 300_000 && bytes < 20 * 1024 * 1024, `Unexpected MP4 size: ${bytes}`)
  const probe = spawnSync(ffmpeg, ['-hide_banner', '-i', video], { encoding: 'utf8' }).stderr ?? ''
  assert.match(probe, /Video: h264[^\n]*1600x900/)
  assert.match(probe, /Audio: aac/)
  const match = probe.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/)
  assert.ok(match, 'Missing video duration')
  const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
  assert.ok(seconds >= 70 && seconds <= 85, `Unexpected video duration: ${seconds}`)
  const loudness = spawnSync(ffmpeg, ['-hide_banner', '-i', video, '-map', '0:a:0', '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }).stderr ?? ''
  const max = loudness.match(/max_volume: (-?[\d.]+) dB/)
  assert.ok(max && Number(max[1]) > -25 && Number(max[1]) < 0, `Silent or clipped voice track: ${max?.[1]}`)
  const poster = readFileSync(join(media, names[1]))
  assert.equal(poster[0], 0xff)
  assert.equal(poster[1], 0xd8)
  const vtt = readFileSync(join(media, names[2]), 'utf8')
  assert.ok(vtt.startsWith('WEBVTT\n'))
  assert.ok((vtt.match(/-->/g) ?? []).length >= 12, 'Captions are too sparse')
  assert.match(vtt, /ВВЭР|СМР/)
  assert.match(vtt, /условн/)
  console.log(`MEDIA_OK ${seconds.toFixed(2)}s ${(bytes / 1024 / 1024).toFixed(2)}MiB`)
}

function verifySite() {
  verifyMedia()
  const overview = readFileSync(join(root, 'src/app/pages/OverviewPage.tsx'), 'utf8')
  assert.match(overview, /<video[^>]*controls[^>]*playsInline[^>]*preload="metadata"/)
  assert.match(overview, /kind="captions"[^>]*srcLang="ru"/)
  assert.match(overview, /import\.meta\.env\.BASE_URL/)
  for (const name of names) assert.match(overview, new RegExp(name.replaceAll('.', '\\.')))
  for (const name of names) assert.ok(existsSync(join(root, 'dist/media', name)), `Missing published dist/media/${name}`)
  console.log('SITE_MEDIA_OK')
}

if (mode === 'media') verifyMedia()
else if (mode === 'site') verifySite()
else if (mode === 'integration') {
  run('npm', ['test'])
  run('npm', ['run', 'build'])
  run('npm', ['run', 'verify:structure'])
  run('node', ['scripts/verify-structure.mjs', '--dist'])
  verifySite()
  console.log('INTEGRATION_OK')
} else throw new Error(`Unknown mode: ${mode}`)
