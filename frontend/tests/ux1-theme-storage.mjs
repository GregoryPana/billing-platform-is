import { chromium } from 'playwright'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const frontendRoot = resolve(dirname(__filename), '..')
const port = 5733

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
try {
  await waitForVite(vite)
  browser = await chromium.launch()
  const context = await browser.newContext({ colorScheme: 'light' })
  const page = await context.newPage()
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
  await page.getByRole('button', { name: /Switch to dark mode/i }).click()
  await page.waitForFunction(() => document.documentElement.classList.contains('dark'))

  const storedAfterToggle = await page.evaluate(() => localStorage.getItem('billing_theme'))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=Theme Foundation Review', { timeout: 15000 })

  const darkAfterReload = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  const colorSchemeAfterReload = await page.evaluate(() => document.documentElement.style.colorScheme)
  const lightToggleAvailable = await page.getByRole('button', { name: /Switch to light mode/i }).count()
  await context.close()

  const lockedContext = await browser.newContext({ colorScheme: 'light' })
  await lockedContext.addInitScript(() => {
    const originalGetItem = Storage.prototype.getItem
    Storage.prototype.getItem = function getItem(key) {
      if (key === 'billing_theme') throw new Error('Synthetic storage read failure')
      return originalGetItem.call(this, key)
    }
    Storage.prototype.setItem = function setItem() {
      throw new Error('Synthetic storage write failure')
    }
  })
  const lockedPage = await lockedContext.newPage()
  await lockedPage.goto(`http://127.0.0.1:${port}/billing/tests/ux1-theme-review.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  })
  await lockedPage.getByRole('button', { name: /Switch to dark mode/i }).click()
  await lockedPage.waitForFunction(() => document.documentElement.classList.contains('dark'))
  const inMemoryToggleWithStorageBlocked = await lockedPage.evaluate(() =>
    document.documentElement.classList.contains('dark')
  )
  await lockedContext.close()

  const passed =
    storedAfterToggle === 'dark' &&
    darkAfterReload &&
    colorSchemeAfterReload === 'dark' &&
    lightToggleAvailable === 1 &&
    inMemoryToggleWithStorageBlocked &&
    consoleErrors.length === 0 &&
    failedRequests.length === 0

  const result = {
    passed,
    storedAfterToggle,
    darkAfterReload,
    colorSchemeAfterReload,
    lightToggleAvailable,
    inMemoryToggleWithStorageBlocked,
    consoleErrors,
    failedRequests,
  }
  console.log(JSON.stringify(result, null, 2))
  if (!passed) process.exitCode = 1
} finally {
  if (browser) await browser.close()
  await stopVite(vite)
}
