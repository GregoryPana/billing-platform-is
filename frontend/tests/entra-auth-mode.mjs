import { chromium } from 'playwright'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { spawn } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const frontendRoot = resolve(__dirname, '..')

const baseEntraEnv = {
  VITE_AUTH_MODE: 'entra',
  VITE_ENTRA_TENANT_ID: 'synthetic-tenant',
  VITE_ENTRA_CLIENT_ID: 'synthetic-client',
  VITE_ENTRA_AUTHORITY: 'https://login.microsoftonline.com/synthetic-tenant',
  VITE_ENTRA_API_SCOPE: 'api://synthetic-client/access_as_user',
  VITE_ENTRA_REDIRECT_URI: 'http://localhost:5701/billing/',
  VITE_ENTRA_POST_LOGOUT_REDIRECT_URI: 'http://localhost:5701/billing/',
}

const scenarios = [
  { name: 'entra_no_session', env: baseEntraEnv, scenario: 'no_session', expectRedirect: true, noLocal: true },
  { name: 'entra_existing_session', env: baseEntraEnv, scenario: 'existing_session', expectRedirect: false, noLocal: true, mockMe: true },
  { name: 'entra_missing_config', env: { VITE_AUTH_MODE: 'entra' }, scenario: 'missing_config', expectRedirect: false, noLocal: true, expectError: true, noRetry: true },
  { name: 'local_mode', env: { VITE_AUTH_MODE: 'local' }, scenario: 'local_mode', expectRedirect: false, noLocal: false },
  { name: 'entra_interaction_required', env: baseEntraEnv, scenario: 'interaction_required', expectRedirect: true, noLocal: true },
  { name: 'invalid_auth_mode', env: { VITE_AUTH_MODE: 'invalid' }, scenario: 'invalid_auth_mode', expectRedirect: false, noLocal: true, expectError: true, noRetry: true },
]

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
    vite.on('error', error => {
      clearTimeout(timer)
      rejectPromise(error)
    })
    vite.on('exit', code => {
      if (code && code !== 0) {
        clearTimeout(timer)
        rejectPromise(new Error(`vite exited ${code}`))
      }
    })
  })
}

async function stopVite(vite) {
  if (vite.exitCode === null) {
    try {
      process.kill(-vite.pid, 'SIGTERM')
    } catch {
      vite.kill('SIGTERM')
    }
    await new Promise(resolvePromise => {
      const timer = setTimeout(resolvePromise, 3000)
      vite.once('exit', () => {
        clearTimeout(timer)
        resolvePromise()
      })
    })
  }
}

async function main() {
  const browser = await chromium.launch()
  const results = []

  try {
    for (let index = 0; index < scenarios.length; index += 1) {
      const scenario = scenarios[index]
      const port = 5701 + index
      const env = { ...process.env }
      for (const key of Object.keys(env)) {
        if (key.startsWith('VITE_')) delete env[key]
      }
      Object.assign(env, scenario.env)
      env.VITE_ENTRA_REDIRECT_URI = `http://localhost:${port}/billing/`
      env.VITE_ENTRA_POST_LOGOUT_REDIRECT_URI = `http://localhost:${port}/billing/`

      const vite = spawn(
        'npx',
        ['vite', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--config', 'vite.entra-test.config.js'],
        { cwd: frontendRoot, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] },
      )

      const page = await browser.newPage()
      const consoleErrors = []
      page.on('console', message => {
        if (message.type() === 'error') consoleErrors.push(message.text())
      })
      page.on('pageerror', error => consoleErrors.push(String(error)))
      await page.addInitScript(name => {
        window.__entraTestScenario = name
      }, scenario.scenario)

      if (scenario.mockMe) {
        await page.route('**/api/auth/me', route => route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'synthetic-user',
            name: 'Synthetic User',
            username: 'synthetic',
            email: 'test@cws.sc',
            role: 'system_admin',
            is_active: true,
            auth_source: 'entra_id',
          }),
        }))
        await page.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
      }

      const details = []
      let passed = true

      try {
        await waitForVite(vite)
        await page.goto(`http://127.0.0.1:${port}/billing/#/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
        await page.waitForTimeout(1000)

        const hasPassword = (await page.locator('input[type="password"]').count()) > 0
        const hasIdentifier = (await page.locator('input[type="text"], input[type="email"]').count()) > 0
        const hasLocalForm = hasPassword || hasIdentifier
        if (scenario.noLocal === hasLocalForm) {
          passed = false
          details.push(`local form visibility was ${hasLocalForm}`)
        }

        const errorTexts = await page.locator('.text-destructive').allTextContents()
        const hasError = errorTexts.some(text => text.trim().length > 0)
        if (Object.hasOwn(scenario, 'expectError') && Boolean(scenario.expectError) !== hasError) {
          passed = false
          details.push(`error surface visibility was ${hasError}: ${JSON.stringify(errorTexts)}`)
        }

        const hasRetry = (await page.getByRole('button', { name: /Try Microsoft Sign-In Again/i }).count()) > 0
        if (scenario.noRetry && hasRetry) {
          passed = false
          details.push('retry button was visible for a static configuration error')
        }

        const redirected = await page.evaluate(() => window.__entraTestLoginRedirectCalled === true)
        if (scenario.expectRedirect !== redirected) {
          passed = false
          details.push(`loginRedirect called was ${redirected}`)
        }
      } catch (error) {
        passed = false
        details.push(String(error))
      } finally {
        await page.close()
        await stopVite(vite)
      }

      results.push({ name: scenario.name, passed, details, consoleErrors })
    }
  } finally {
    await browser.close()
  }

  console.log(JSON.stringify(results, null, 2))
  if (results.some(result => !result.passed)) process.exit(1)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
