import { InteractionRequiredAuthError, PublicClientApplication } from "@azure/msal-browser"

// VITE_AUTH_MODE is the authoritative authentication-mode contract for the
// frontend, mirroring the backend's AUTH_MODE - "local" (default; the
// LoginPage form is used) or "entra" (Microsoft Entra ID sign-in is
// mandatory and the local LoginPage is never rendered). Do not gate
// production behavior on Entra config values merely being present.
const raw_auth_mode = String(import.meta.env.VITE_AUTH_MODE || "local").trim().toLowerCase()
const auth_mode_is_valid = raw_auth_mode === "local" || raw_auth_mode === "entra"
export const auth_mode = auth_mode_is_valid ? raw_auth_mode : "invalid"
export const is_entra_auth_mode = auth_mode === "entra"
export const auth_mode_config_error = auth_mode_is_valid
  ? null
  : "Authentication mode is invalid for this deployment. Contact an administrator."

const tenant_id = import.meta.env.VITE_ENTRA_TENANT_ID || ""
const client_id = import.meta.env.VITE_ENTRA_CLIENT_ID || ""
const authority = import.meta.env.VITE_ENTRA_AUTHORITY || (tenant_id ? `https://login.microsoftonline.com/${tenant_id}` : "")
const redirect_uri = import.meta.env.VITE_ENTRA_REDIRECT_URI || `${window.location.origin}/billing/`
const post_logout_redirect_uri = import.meta.env.VITE_ENTRA_POST_LOGOUT_REDIRECT_URI || redirect_uri
const api_scope = import.meta.env.VITE_ENTRA_API_SCOPE || (client_id ? `api://${client_id}/access_as_user` : "")

const entra_configured = Boolean(tenant_id && client_id && authority && api_scope)

// True only when Entra mode is explicitly requested AND the required public
// Entra settings are present - the single flag the rest of the app should
// branch on to decide whether MSAL can actually be used.
export const entra_enabled = is_entra_auth_mode && entra_configured

// Set when Entra mode is requested but required public settings are
// missing - callers must show a fail-closed configuration error, never fall
// back to local sign-in.
export const entra_config_error = auth_mode_config_error || (is_entra_auth_mode && !entra_configured
  ? "Microsoft Entra ID sign-in is not fully configured for this deployment. Contact an administrator."
  : null)

let msal_client_promise = null

function get_msal_client() {
  if (!entra_enabled) {
    return null
  }
  if (!msal_client_promise) {
    msal_client_promise = PublicClientApplication.createPublicClientApplication({
      auth: {
        clientId: client_id,
        authority,
        redirectUri: redirect_uri,
        postLogoutRedirectUri: post_logout_redirect_uri,
      },
      cache: {
        cacheLocation: "sessionStorage",
      },
    })
  }
  return msal_client_promise
}

function ensure_active_account(client) {
  let account = client.getActiveAccount()
  if (account) {
    return account
  }
  const [first_account] = client.getAllAccounts()
  if (first_account) {
    client.setActiveAccount(first_account)
    account = first_account
  }
  return account
}

/**
 * Completes any in-flight redirect response and returns the active
 * account, without acquiring a token and without starting a new redirect.
 * Callers use this to decide whether a sign-in redirect is needed.
 */
export async function complete_entra_redirect() {
  const client = await get_msal_client()
  if (!client) {
    return null
  }
  const redirect_result = await client.handleRedirectPromise()
  if (redirect_result?.account) {
    client.setActiveAccount(redirect_result.account)
  }
  return ensure_active_account(client)
}

/**
 * Acquires an API access token for the current active account. Returns
 * null if there is no active account or if silent acquisition needs
 * interaction (caller should fall back to sign_in_with_entra()).
 */
export async function acquire_entra_token() {
  const client = await get_msal_client()
  if (!client) {
    return null
  }
  const account = ensure_active_account(client)
  if (!account) {
    return null
  }
  try {
    const token_response = await client.acquireTokenSilent({
      account,
      scopes: [api_scope],
    })
    return token_response.accessToken
  } catch (error) {
    const interaction_required =
      error instanceof InteractionRequiredAuthError ||
      ["interaction_required", "consent_required", "login_required"].includes(error?.errorCode)
    if (interaction_required) {
      return null
    }
    throw error
  }
}

export async function sign_in_with_entra() {
  const client = await get_msal_client()
  if (!client) {
    throw new Error("Entra authentication is not configured.")
  }
  await client.loginRedirect({ scopes: [api_scope] })
}

export async function sign_out_from_entra() {
  const client = await get_msal_client()
  if (!client) {
    return
  }
  await client.logoutRedirect()
}
