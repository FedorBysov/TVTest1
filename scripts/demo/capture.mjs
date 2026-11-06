import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const work = join(root, '.cache/demo')
const raw = join(work, 'raw')
const checkpoints = join(work, 'checkpoints')
mkdirSync(raw, { recursive: true })
mkdirSync(checkpoints, { recursive: true })
process.env.PLAYWRIGHT_BROWSERS_PATH ??= join(root, '.cache/ms-playwright')
const { chromium } = await import('playwright-core')

const url = process.env.DEMO_URL ?? 'https://fedorbysov.github.io/TVTest1/'
const browser = await chromium.launch({
  executablePath: process.env.DEMO_CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-gl=swiftshader'],
})
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  reducedMotion: 'reduce',
  recordVideo: { dir: raw, size: { width: 1440, height: 900 } },
})
let page
const errors = []
const chapters = []
const started = performance.now()
let ready = started

const pause = async (ms) => page.waitForTimeout(ms)
const shot = async (name) => page.screenshot({ path: join(checkpoints, `${name}.png`) })
const nav = async (route) => {
  await page.locator(`nav[aria-label="Основная навигация"] a[href="#/${route}"]`).click()
  await page.waitForURL(`**/#/${route}`)
}
const chapter = async (id, minimumSeconds, action) => {
  const start = performance.now()
  const startSeconds = (start - ready) / 1000
  const waitTo = async (seconds) => {
    const remaining = seconds * 1000 - (performance.now() - start)
    if (remaining > 0) await pause(remaining)
  }
  await action({ waitTo })
  const elapsed = (performance.now() - start) / 1000
  if (elapsed < minimumSeconds) await pause((minimumSeconds - elapsed) * 1000)
  const endSeconds = (performance.now() - ready) / 1000
  chapters.push({ id, startSeconds, endSeconds, minimumSeconds })
  console.log(`${id}: ${startSeconds.toFixed(2)}–${endSeconds.toFixed(2)}s`)
}

try {
  page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 })
  await page.locator('.scene-viewport canvas').waitFor({ state: 'visible' })
  await pause(700)
  ready = performance.now()
  await page.evaluate(() => {
    const cursor = document.createElement('div')
    cursor.setAttribute('aria-hidden', 'true')
    cursor.style.cssText = 'position:fixed;left:0;top:0;width:16px;height:21px;pointer-events:none;z-index:2147483647;opacity:0;filter:drop-shadow(0 1px 2px #0009);transform:translate(-30px,-30px)'
    cursor.innerHTML = '<svg viewBox="0 0 16 21" width="16" height="21"><path d="M1 1v16l4-4 3 7 3-1-3-7h6z" fill="#9fe5db" stroke="#102a32" stroke-width="1.4"/></svg>'
    document.body.appendChild(cursor)
    const host = () => document.querySelector('dialog[open]') ?? document.body
    new MutationObserver(() => { if (cursor.parentElement !== host()) host().appendChild(cursor) }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] })
    document.addEventListener('pointermove', (event) => {
      cursor.style.opacity = '1'
      cursor.style.transform = `translate(${event.clientX}px,${event.clientY}px)`
    }, true)
    document.addEventListener('pointerdown', (event) => {
      const ring = document.createElement('span')
      ring.style.cssText = `position:fixed;left:${event.clientX - 13}px;top:${event.clientY - 13}px;width:26px;height:26px;border:2px solid #9fe5db;border-radius:50%;pointer-events:none;z-index:2147483646;box-shadow:0 0 12px #62e1d8;animation:demo-ring .55s ease-out forwards`
      host().appendChild(ring)
      setTimeout(() => ring.remove(), 650)
    }, true)
    const style = document.createElement('style')
    style.textContent = '@keyframes demo-ring{from{opacity:1;transform:scale(.45)}to{opacity:0;transform:scale(1.8)}}'
    document.head.appendChild(style)
  })

  await chapter('01', 10.7, async () => {
    await page.mouse.move(930, 520, { steps: 24 })
    await pause(1300)
    await shot('01-overview-vver')
  })

  await chapter('02', 14.8, async ({ waitTo }) => {
    await page.getByRole('button', { name: /Развернуть стол/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Расширенный учебный стол' })
    await dialog.waitFor({ state: 'visible' })
    await pause(850)
    await shot('02-workbench-vver')
    const before = (await dialog.locator('.workbench-command-group .is-active').textContent())?.trim()
    await page.mouse.move(546, 442, { steps: 25 })
    await page.mouse.click(546, 442)
    const after = (await dialog.locator('.workbench-command-group .is-active').textContent())?.trim()
    if (before === after) throw new Error('Physical 3D control did not change command')
    await pause(800)
    const toolbar = dialog.getByRole('toolbar', { name: 'Навигация по щиту' })
    await toolbar.getByRole('button', { name: 'Мощность' }).click()
    await pause(1000)
    await toolbar.getByRole('button', { name: 'Увеличить щит' }).click()
    await pause(650)
    await toolbar.getByRole('button', { name: 'Весь щит' }).click()
    await dialog.locator('.workbench-stage-group button').nth(1).click()
    await pause(500)
    await shot('02-control-changed')
    await waitTo(13.5)
    await dialog.getByRole('button', { name: /Свернуть/ }).click()
  })

  await chapter('03', 6.2, async ({ waitTo }) => {
    await page.getByRole('button', { name: 'СМР', exact: true }).click()
    await pause(1100)
    await shot('03-smr')
    await page.getByRole('button', { name: /Развернуть стол/ }).click()
    await pause(1000)
    await shot('03-smr-workbench')
    await waitTo(5.5)
    await page.getByRole('dialog', { name: 'Расширенный учебный стол' }).getByRole('button', { name: /Свернуть/ }).click()
  })

  await chapter('04', 12.1, async ({ waitTo }) => {
    await nav('scenarios')
    await page.locator('.stage-panel .stage-strip button').nth(1).click()
    await page.getByRole('button', { name: 'Продолжить время' }).click()
    await pause(500)
    await shot('04-five-stages')
    await waitTo(5.0)
    await nav('console')
    await page.locator('.zone-tabs button').nth(1).click()
    await page.getByRole('button', { name: 'Увеличить учебную команду' }).click()
    await pause(1100)
    await shot('04-instrument-module')
    await waitTo(11.2)
  })

  await chapter('05', 17.0, async ({ waitTo }) => {
    await nav('scenarios')
    await page.locator('.scenario-card').nth(1).click()
    await page.getByRole('button', { name: 'Ввести учебное отклонение' }).click()
    await page.getByRole('button', { name: '+10 с учебного времени' }).click()
    await pause(900)
    await page.locator('.reference-panel').scrollIntoViewIfNeeded()
    await shot('05-flow-comparison')
    await waitTo(7.0)
    await nav('console')
    await page.locator('.zone-tabs button').nth(1).click()
    await page.getByRole('button', { name: 'Записать наблюдение этой зоны' }).click()
    await pause(650)
    await page.locator('.control-panel button.primary-button').click()
    await pause(750)
    await shot('05-observed-acknowledged')
    await waitTo(14.8)
    await page.getByRole('button', { name: 'Устранить учебную причину' }).click()
  })

  await chapter('06', 15.0, async ({ waitTo }) => {
    await nav('session')
    await pause(550)
    await shot('06-journal')
    await waitTo(5.0)
    const event = page.locator('.event-item').first()
    await event.click()
    await pause(800)
    await shot('06-event-snapshot')
    await waitTo(8.5)
    await page.locator('.assessment-panel').scrollIntoViewIfNeeded()
    await page.locator('.assessment-route').first().locator('summary').click()
    await pause(800)
    await shot('06-assessment')
  })

  if (errors.length) throw new Error(`Browser page errors: ${errors.join(' | ')}`)
  await pause(500)
} finally {
  await context.close()
  await browser.close()
}

const videoPath = await page.video().path()
const output = join(work, 'raw.webm')
copyFileSync(videoPath, output)
const manifest = {
  url,
  viewport: { width: 1440, height: 900 },
  readyOffsetSeconds: (ready - started) / 1000,
  chapters,
  output,
  checkpoints,
}
writeFileSync(join(work, 'capture-manifest.json'), JSON.stringify(manifest, null, 2))
console.log(`CAPTURE_OK ${output}`)
