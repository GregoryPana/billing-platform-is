import { chromium } from 'playwright'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const frontendRoot = resolve(dirname(__filename), '..')
const port = 5730
const viewports = [375, 768, 1024, 1440]

async function measureSemanticContrast(page) {
  return page.evaluate(() => {
    const root = getComputedStyle(document.documentElement)
    const parseHsl = name => {
      const [h, s, l] = root.getPropertyValue(name).trim().split(/\s+/).map(Number.parseFloat)
      const saturation = s / 100
      const lightness = l / 100
      const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
      const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1))
      const offset = lightness - chroma / 2
      let rgb
      if (h < 60) rgb = [chroma, x, 0]
      else if (h < 120) rgb = [x, chroma, 0]
      else if (h < 180) rgb = [0, chroma, x]
      else if (h < 240) rgb = [0, x, chroma]
      else if (h < 300) rgb = [x, 0, chroma]
      else rgb = [chroma, 0, x]
      return rgb.map(channel => channel + offset)
    }
    const blend = (foreground, background, alpha) =>
      foreground.map((channel, index) => alpha * channel + (1 - alpha) * background[index])
    const luminance = color => {
      const linear = color.map(channel =>
        channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
      )
      return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
    }
    const ratio = (first, second) => {
      const values = [luminance(first), luminance(second)].sort((a, b) => b - a)
      return (values[0] + 0.05) / (values[1] + 0.05)
    }

    const card = parseHsl('--card')
    return ['success', 'warning', 'destructive', 'info'].flatMap(tone => {
      const base = parseHsl(`--${tone}`)
      const foreground = parseHsl(`--${tone}-foreground`)
      const softForeground = parseHsl(tone === 'warning' ? '--warning-soft-foreground' : `--${tone}`)
      return [
        { name: `${tone}-solid`, ratio: ratio(foreground, base) },
        { name: `${tone}-tint-15`, ratio: ratio(softForeground, blend(base, card, 0.15)) },
      ]
    })
  })
}

async function measureLayout(page) {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth
    const overflowingElements = [...document.body.querySelectorAll('*')]
      .filter(element => {
        const style = getComputedStyle(element)
        if (style.display === 'none' || style.visibility === 'hidden') return false
        const rect = element.getBoundingClientRect()
        return rect.width > 0 && (rect.left < -1 || rect.right > viewportWidth + 1)
      })
      .slice(0, 10)
      .map(element => ({
        tag: element.tagName.toLowerCase(),
        className: String(element.className).slice(0, 120),
        text: element.textContent?.trim().slice(0, 80),
      }))

    return {
      documentOverflow: document.documentElement.scrollWidth > viewportWidth,
      overflowingElements,
    }
  })
}

async function waitForVite(vite) {
  await new Promise((resolvePromise, rejectPromise) => {
    const timer = setTimeout(() => rejectPromise(new Error('vite timeout')), 30000)
    const ready = data => {
      if (String(data).includes('Local:')) {
        clearTimeout(timer)
        resolvePromise()
      }
    }
    const failed = error => {
      clearTimeout(timer)
      rejectPromise(error)
    }
    vite.stdout.on('data', ready)
    vite.stderr.on('data', ready)
    vite.once('error', failed)
    vite.once('exit', code => {
      if (code !== null && code !== 0) failed(new Error(`vite exited before readiness (${code})`))
    })
  })
}

async function stopVite(vite) {
  if (vite.exitCode !== null) return
  const exited = new Promise(resolvePromise => vite.once('exit', resolvePromise))
  try {
    process.kill(-vite.pid, 'SIGTERM')
  } catch {
    vite.kill('SIGTERM')
  }
  const stopped = await Promise.race([
    exited.then(() => true),
    new Promise(resolvePromise => setTimeout(() => resolvePromise(false), 5000)),
  ])
  if (!stopped && vite.exitCode === null) {
    try {
      process.kill(-vite.pid, 'SIGKILL')
    } catch {
      vite.kill('SIGKILL')
    }
    await exited
  }
}

const vite = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: frontendRoot,
  detached: true,
  stdio: ['ignore', 'pipe', 'pipe'],
})

let browser
const results = []
try {
  await waitForVite(vite)
  browser = await chromium.launch()

  for (const width of viewports) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    await page.addInitScript(() => localStorage.setItem('billing_theme', 'light'))
    const consoleErrors = []
    const failedRequests = []
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    page.on('pageerror', error => consoleErrors.push(String(error)))
    page.on('requestfailed', request => failedRequests.push(request.url()))

    await page.goto(`http://127.0.0.1:${port}/billing/tests/ux1-theme-review.html`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await page.waitForSelector('text=Theme Foundation Review', { timeout: 15000 })

    const lightBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    const hasDarkClassInitially = await page.evaluate(() => document.documentElement.classList.contains('dark'))
    const lightContrast = await measureSemanticContrast(page)
    const lightLayout = await measureLayout(page)

    await page.getByRole('button', { name: /Switch to dark mode/i }).click()
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'))
    const darkBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    const darkContrast = await measureSemanticContrast(page)
    const darkLayout = await measureLayout(page)

    const failingContrast = [...lightContrast, ...darkContrast].filter(sample => sample.ratio < 4.5)
    const badgeCount = await page.locator('span', { hasText: 'Info' }).count()
    const infoSwatchPresent = await page.locator('text=--info').count()

    await page.getByRole('button', { name: /Switch to light mode/i }).click()
    await page.waitForFunction(() => !document.documentElement.classList.contains('dark'))

    const focusable = page.getByRole('button', { name: 'Default', exact: true })
    await page.locator('body').click({ position: { x: 5, y: 5 } })
    let focusBoxShadow = null
    for (let tab = 0; tab < 40 && !focusBoxShadow; tab += 1) {
      await page.keyboard.press('Tab')
      focusBoxShadow = await focusable.evaluate(element =>
        element === document.activeElement ? getComputedStyle(element).boxShadow : null
      )
    }

    await page.emulateMedia({ reducedMotion: 'reduce' })
    const reducedMotionDuration = await page.locator('.animate-spin').evaluate(element =>
      getComputedStyle(element).animationDuration
    )
    const reducedMotionSeconds = reducedMotionDuration.endsWith('ms')
      ? Number.parseFloat(reducedMotionDuration) / 1000
      : Number.parseFloat(reducedMotionDuration)

    const passed =
      !hasDarkClassInitially &&
      lightBackground !== darkBackground &&
      infoSwatchPresent > 0 &&
      badgeCount > 0 &&
      Boolean(focusBoxShadow) &&
      focusBoxShadow !== 'none' &&
      failingContrast.length === 0 &&
      !lightLayout.documentOverflow &&
      !darkLayout.documentOverflow &&
      lightLayout.overflowingElements.length === 0 &&
      darkLayout.overflowingElements.length === 0 &&
      reducedMotionSeconds <= 0.001 &&
      consoleErrors.length === 0 &&
      failedRequests.length === 0

    results.push({
      width,
      passed,
      lightBackground,
      darkBackground,
      badgeCount,
      infoSwatchPresent,
      focusBoxShadow,
      reducedMotionDuration,
      minimumContrast: Math.min(
        ...lightContrast.map(sample => sample.ratio),
        ...darkContrast.map(sample => sample.ratio)
      ),
      lightContrast,
      darkContrast,
      failingContrast,
      lightLayout,
      darkLayout,
      consoleErrors,
      failedRequests,
    })

    await page.close()
  }

  console.log(JSON.stringify(results, null, 2))
  if (results.some(result => !result.passed)) process.exitCode = 1
} finally {
  if (browser) await browser.close()
  await stopVite(vite)
}
