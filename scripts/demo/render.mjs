import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const work = join(root, '.cache/demo')
const media = join(root, 'public/media')
const capture = JSON.parse(readFileSync(join(work, 'capture-manifest.json'), 'utf8'))
const speech = JSON.parse(readFileSync(join(work, 'audio/manifest.json'), 'utf8'))
const ffmpeg = process.env.DEMO_FFMPEG ?? '/Applications/identityproxy.app/Contents/Resources/ffmpeg/macos/aarch64/ffmpeg'
const font = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
const transition = 0.32
const count = capture.chapters.length
if (count !== 6 || speech.clips.length !== count) throw new Error('Expected six matching chapters and narration clips')
mkdirSync(media, { recursive: true })

const lengths = capture.chapters.map((chapter) => chapter.endSeconds - chapter.startSeconds)
for (let index = 0; index < count; index++) {
  if (speech.clips[index].id !== capture.chapters[index].id) throw new Error(`Chapter/audio mismatch at ${index}`)
  if (speech.clips[index].duration > lengths[index] - 0.2) throw new Error(`Narration ${index + 1} exceeds scene duration`)
}

const inputArgs = ['-i', capture.output]
for (const clip of speech.clips) inputArgs.push('-i', clip.audio)
const graph = [`[0:v]split=${count}${Array.from({ length: count }, (_, index) => `[v${index}]`).join('')}`]
for (let index = 0; index < count; index++) {
  const chapter = capture.chapters[index]
  const start = capture.readyOffsetSeconds + chapter.startSeconds
  const end = capture.readyOffsetSeconds + chapter.endSeconds
  const title = join(root, `docs/demo-video/titles/${chapter.id}.txt`)
  const titleTime = Math.min(3.1, lengths[index] - 0.5)
  let video = `[v${index}]trim=start=${start.toFixed(3)}:end=${end.toFixed(3)},setpts=PTS-STARTPTS,fps=25,scale=1440:900,pad=1600:900:80:0:color=0x0d1820,setsar=1,format=yuv420p,settb=AVTB`
  video += `,drawbox=x=100:y=739:w=720:h=66:color=0x10252e@0.92:t=fill:enable='lt(t,${titleTime.toFixed(2)})'`
  video += `,drawbox=x=100:y=739:w=5:h=66:color=0x8adbd2:t=fill:enable='lt(t,${titleTime.toFixed(2)})'`
  video += `,drawtext=fontfile='${font}':textfile='${title}':fontcolor=0xe3f7f3:fontsize=27:x=124:y=758:enable='lt(t,${titleTime.toFixed(2)})'`
  if (index === count - 1) {
    const outro = join(root, 'docs/demo-video/titles/outro.txt')
    const outroStart = Math.max(0, lengths[index] - 3.2)
    video += `,drawbox=x=100:y=739:w=1050:h=66:color=0x10252e@0.94:t=fill:enable='gte(t,${outroStart.toFixed(2)})'`
    video += `,drawtext=fontfile='${font}':textfile='${outro}':fontcolor=0xe3f7f3:fontsize=26:x=124:y=758:enable='gte(t,${outroStart.toFixed(2)})'`
  }
  graph.push(`${video}[c${index}]`)
  graph.push(`[${index + 1}:a]aresample=48000,aformat=channel_layouts=stereo,apad,atrim=duration=${lengths[index].toFixed(3)},asetpts=PTS-STARTPTS[a${index}]`)
}

let videoLabel = 'c0'
let audioLabel = 'a0'
let running = lengths[0]
for (let index = 1; index < count; index++) {
  const nextVideo = `x${index}`
  const nextAudio = `m${index}`
  graph.push(`[${videoLabel}][c${index}]xfade=transition=fade:duration=${transition}:offset=${(running - transition).toFixed(3)}[${nextVideo}]`)
  graph.push(`[${audioLabel}][a${index}]acrossfade=d=${transition}:c1=tri:c2=tri[${nextAudio}]`)
  videoLabel = nextVideo
  audioLabel = nextAudio
  running += lengths[index] - transition
}
// Chrome produces two empty WebGL remount frames at the SMR dialog cut in this
// captured take. Replace only those frames with the next fully rendered frame.
graph.push(`[${videoLabel}]split=2[videoMain][videoRepair]`)
graph.push('[videoMain][videoRepair]freezeframes=first=675:last=676:replace=678[videoFixed]')
graph.push(`[videoFixed]fade=t=in:st=0:d=0.25,fade=t=out:st=${(running - 0.5).toFixed(3)}:d=0.5[vout]`)
graph.push(`[${audioLabel}]highpass=f=90,lowpass=f=12000,acompressor=threshold=0.1:ratio=2:attack=10:release=180,volume=1.12,afade=t=in:st=0:d=0.25,afade=t=out:st=${(running - 0.55).toFixed(3)}:d=0.55[aout]`)

const output = join(media, 'tvtest1-demo.mp4')
const result = spawnSync(ffmpeg, [
  '-y', '-hide_banner', '-loglevel', 'warning', '-stats', ...inputArgs,
  '-filter_complex', graph.join(';'), '-map', '[vout]', '-map', '[aout]',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '24', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-movflags', '+faststart',
  output,
], { stdio: 'inherit' })
if (result.status !== 0) throw new Error(`FFmpeg render failed with exit ${result.status}`)

const posterior = spawnSync(ffmpeg, [
  '-y', '-hide_banner', '-loglevel', 'error', '-ss', '15', '-i', output,
  '-frames:v', '1', '-vf', 'scale=1280:720', '-q:v', '3', join(media, 'tvtest1-demo-poster.jpg'),
], { stdio: 'inherit' })
if (posterior.status !== 0) throw new Error(`Poster extraction failed with exit ${posterior.status}`)

function timestamp(seconds) {
  const ms = Math.round(seconds * 1000)
  const hours = String(Math.floor(ms / 3600000)).padStart(2, '0')
  const minutes = String(Math.floor(ms % 3600000 / 60000)).padStart(2, '0')
  const secs = String(Math.floor(ms % 60000 / 1000)).padStart(2, '0')
  const remainder = String(ms % 1000).padStart(3, '0')
  return `${hours}:${minutes}:${secs}.${remainder}`
}

function visibleText(text) {
  return text.replace('Ти-ви-тест один', 'TVTest1').replace('ве-ве-эр', 'ВВЭР').replace('Эс-эм-эр', 'СМР')
}

const cues = []
let sceneStart = 0
for (let index = 0; index < count; index++) {
  const clip = speech.clips[index]
  const sentences = visibleText(clip.text).match(/[^.!?]+[.!?]?/gu)?.map((part) => part.trim()).filter(Boolean) ?? []
  const totalCharacters = sentences.reduce((sum, sentence) => sum + sentence.length, 0)
  let used = 0
  for (const sentence of sentences) {
    const start = sceneStart + clip.duration * used / totalCharacters
    used += sentence.length
    const end = sceneStart + clip.duration * used / totalCharacters
    const wrapped = sentence.replace(/(.{1,56})(?:\s+|$)/gu, '$1\n').trim()
    cues.push(`${timestamp(start)} --> ${timestamp(end)}\n${wrapped}`)
  }
  sceneStart += lengths[index] - (index === count - 1 ? 0 : transition)
}
const vtt = `WEBVTT\n\n${cues.join('\n\n')}\n`
writeFileSync(join(media, 'tvtest1-demo.ru.vtt'), vtt)

const probe = spawnSync(ffmpeg, ['-hide_banner', '-i', output], { encoding: 'utf8' })
const streamInfo = probe.stderr ?? ''
if (!/Video: h264/.test(streamInfo) || !/Audio: aac/.test(streamInfo)) throw new Error(`Expected H.264 video and AAC audio: ${streamInfo}`)
const durationMatch = streamInfo.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/)
if (!durationMatch) throw new Error('Could not measure final duration')
const duration = Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3])
const bytes = statSync(output).size
const renderManifest = { output, duration, bytes, resolution: [1600, 900], fps: 25, video: 'H.264', audio: 'AAC / Milena ru_RU', chapters: capture.chapters.map((chapter, index) => ({ id: chapter.id, title: readFileSync(join(root, `docs/demo-video/titles/${chapter.id}.txt`), 'utf8').trim(), start: capture.chapters.slice(0, index).reduce((sum, entry) => sum + entry.endSeconds - entry.startSeconds - transition, 0) })) }
writeFileSync(join(work, 'render-manifest.json'), JSON.stringify(renderManifest, null, 2))
if (duration < 60 || duration > 90 || bytes > 20 * 1024 * 1024) throw new Error(`Unexpected final media size/duration: ${duration}s, ${bytes} bytes`)
console.log(`RENDER_OK ${duration.toFixed(2)}s ${(bytes / 1024 / 1024).toFixed(2)} MiB`)
