import { chromium } from 'playwright'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const frontendRoot = resolve(dirname(__filename), '..')
const port = 5710

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

const vite = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: frontendRoot,
  detached: true,
  stdio: ['ignore', 'pipe', 'pipe'],
})

const browser = await chromium.launch()
try {
  await waitForVite(vite)
  const page = await browser.newPage()
  const expectedErrors = []
  page.on('pageerror', error => expectedErrors.push(String(error)))
  await page.goto(`http://127.0.0.1:${port}/billing/tests/route-error-boundary.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  })
  const alert = page.getByRole('alert')
  await alert.waitFor({ state: 'visible' })
  const message = await alert.textContent()
  const reloadVisible = await page.getByRole('button', { name: 'Reload' }).isVisible()
  if (!message?.includes('This page failed to load') || !reloadVisible) {
    throw new Error(`Unexpected error-boundary surface: ${message}`)
  }
  console.log(JSON.stringify({ passed: true, message, reloadVisible, faultInjected: expectedErrors.length > 0 }))
  await page.close()
} finally {
  await browser.close()
  await stopVite(vite)
}
