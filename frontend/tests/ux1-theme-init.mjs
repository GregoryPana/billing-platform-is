import { chromium } from 'playwright'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { readFileSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const frontendRoot = resolve(dirname(__filename), '..')
const port = 5732

async function waitForVite(vite) {
  await new Promise((resolvePromise, rejectPromise) => {
    const timer = setTimeout(() => rejectPromise(new Error('vite timeout')), 30000)
    const ready = data => {
      if (String(data).includes('Local:')) {
        clearTimeout(timer)
        resolvePromise()
      }
    }
    vite.stdout.on('data', ready)
    vite.stderr.on('data', ready)
    vite.on('error', rejectPromise)
  })
}

async function stopVite(vite) {
  if (vite.exitCode === null) {
    try {
      process.kill(-vite.pid, 'SIGTERM')
    } catch {
      vite.kill('SIGTERM')
    }
  }
}

// Parity check: the inline bootstrap in index.html must implement the exact
// same algorithm as resolve_initial_theme() in src/lib/theme.js. Rather than
// trust a comment to keep them in sync, extract both and run them against
// the same input matrix here.
function checkInlineBootstrapParity() {
  const html = readFileSync(resolve(frontendRoot, 'index.html'), 'utf8')
  const scriptMatch = html.match(/<script>\s*\/\* Pre-paint theme bootstrap[\s\S]*?<\/script>/)
  if (!scriptMatch) throw new Error('inline theme bootstrap script not found in index.html')
  const inlineBody = scriptMatch[0].replace(/<\/?script>/g, '')

  const themeSource = readFileSync(resolve(frontendRoot, 'src/lib/theme.js'), 'utf8')
  const keyMatch = themeSource.match(/export const THEME_KEY = .*/)
  if (!keyMatch) throw new Error('THEME_KEY not found in src/lib/theme.js')
  const fnMatch = themeSource.match(/export function resolve_initial_theme\(\) \{[\s\S]*?\n\}/)
  if (!fnMatch) throw new Error('resolve_initial_theme not found in src/lib/theme.js')
  const fnBody = `${keyMatch[0].replace(/^export\s+/, '')}\n${fnMatch[0].replace(/^export\s+/, '')}`

  const scenarios = [
    { stored: 'dark', prefersDark: false, expected: 'dark' },
    { stored: 'light', prefersDark: true, expected: 'light' },
    { stored: null, prefersDark: true, expected: 'dark' },
    { stored: null, prefersDark: false, expected: 'light' },
    { stored: 'garbage', prefersDark: true, expected: 'dark' },
  ]

  const results = scenarios.map(scenario => {
    const store = { billing_theme: scenario.stored }
    const fakeWindow = {
      localStorage: { getItem: key => (key in store ? store[key] : null) },
      matchMedia: () => ({ matches: scenario.prefersDark }),
    }

    const runResolve = new Function('window', `${fnBody}\nreturn resolve_initial_theme()`)
    const moduleResult = runResolve(fakeWindow)

    const fakeDocument = { documentElement: { classList: { added: false, add() { this.added = true } }, style: {} } }
    const runInline = new Function('window', 'document', `${inlineBody}`)
    runInline(fakeWindow, fakeDocument)
    const inlineResult = fakeDocument.documentElement.classList.added ? 'dark' : 'light'

    return {
      scenario,
      moduleResult,
      inlineResult,
      matches: moduleResult === scenario.expected && inlineResult === scenario.expected,
    }
  })

  return results
}

async function main() {
  const parity = checkInlineBootstrapParity()
  const parity_passed = parity.every(r => r.matches)

  const vite = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: frontendRoot,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const browser = await chromium.launch()
  const results = []

  try {
    await waitForVite(vite)

    const scenarios = [
      { name: 'saved_dark', stored: 'dark', prefersDark: false, expectDark: true },
      { name: 'saved_light', stored: 'light', prefersDark: true, expectDark: false },
      { name: 'system_dark_fallback', stored: null, prefersDark: true, expectDark: true },
      { name: 'system_light_fallback', stored: null, prefersDark: false, expectDark: false },
    ]

    for (const scenario of scenarios) {
      const context = await browser.newContext({ colorScheme: scenario.prefersDark ? 'dark' : 'light' })
      // Block the app bundle entirely so React never mounts — this proves
      // the theme class comes from the inline bootstrap alone, not from any
      // app-mount-time effect (i.e. there is no flash to begin with).
      await context.route('**/src/main.jsx*', route => route.abort())
      const page = await context.newPage()

      await page.addInitScript(stored => {
        if (stored) {
          window.localStorage.setItem('billing_theme', stored)
        } else {
          window.localStorage.removeItem('billing_theme')
        }
      }, scenario.stored)

      const consoleErrors = []
      page.on('pageerror', error => consoleErrors.push(String(error)))

      await page.goto(`http://127.0.0.1:${port}/billing/`, { waitUntil: 'load', timeout: 30000 }).catch(() => {})
      await page.waitForTimeout(200)

      const has_dark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
      const color_scheme = await page.evaluate(() => document.documentElement.style.colorScheme)
      const app_mounted = await page.evaluate(() => document.getElementById('root')?.childElementCount > 0)

      results.push({
        name: scenario.name,
        passed:
          has_dark === scenario.expectDark &&
          color_scheme === (scenario.expectDark ? 'dark' : 'light') &&
          !app_mounted,
        has_dark,
        color_scheme,
        app_mounted,
        note: 'app_mounted must be false — proves the class was set by the inline bootstrap, not by React',
      })

      await page.close()
      await context.close()
    }
  } finally {
    await browser.close()
    await stopVite(vite)
  }

  console.log(
    JSON.stringify(
      {
        parity: { passed: parity_passed, results: parity },
        init: results,
      },
      null,
      2
    )
  )

  if (!parity_passed || results.some(r => !r.passed)) process.exit(1)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
