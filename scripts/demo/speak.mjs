import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const outputDir = join(root, '.cache/demo/audio')
const sourceDir = join(root, 'docs/demo-video/narration')
const ffmpeg = process.env.DEMO_FFMPEG ?? '/Applications/identityproxy.app/Contents/Resources/ffmpeg/macos/aarch64/ffmpeg'
const rate = process.env.DEMO_SPEECH_RATE ?? '158'
mkdirSync(outputDir, { recursive: true })

const clips = []
for (let number = 1; number <= 6; number++) {
  const id = String(number).padStart(2, '0')
  const source = join(sourceDir, `${id}.txt`)
  const audio = join(outputDir, `${id}.aiff`)
  const text = readFileSync(source, 'utf8').trim()
  const spoken = spawnSync('/usr/bin/say', ['-v', 'Milena', '-r', rate, '-f', source, '-o', audio], { encoding: 'utf8' })
  if (spoken.status !== 0) throw new Error(`say failed for ${id}: ${spoken.stderr}`)
  const probed = spawnSync(ffmpeg, ['-hide_banner', '-i', audio], { encoding: 'utf8' })
  const match = (probed.stderr ?? '').match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/)
  if (!match) throw new Error(`Could not measure duration of ${audio}: ${probed.stderr}`)
  const duration = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
  clips.push({ id, text, audio, duration })
  console.log(`${id}: ${duration.toFixed(2)}s`)
}
writeFileSync(join(outputDir, 'manifest.json'), JSON.stringify({ voice: 'Milena', speechRate: Number(rate), clips }, null, 2))
console.log(`Total spoken duration: ${clips.reduce((total, clip) => total + clip.duration, 0).toFixed(2)}s`)
