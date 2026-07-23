import { PublicClientApplication } from "@azure/msal-browser"


const entra_enabled_flag = String(import.meta.env.VITE_ENTRA_ENABLED || "").toLowerCase() === "true"
const tenant_id = import.meta.env.VITE_ENTRA_TENANT_ID || ""
const client_id = import.meta.env.VITE_ENTRA_CLIENT_ID || ""
const authority = import.meta.env.VITE_ENTRA_AUTHORITY || (tenant_id ? `https://login.microsoftonline.com/${tenant_id}` : "")
const redirect_uri = import.meta.env.VITE_ENTRA_REDIRECT_URI || `${window.location.origin}/billing/`
const post_logout_redirect_uri = import.meta.env.VITE_ENTRA_POST_LOGOUT_REDIRECT_URI || redirect_uri
const api_scope = import.meta.env.VITE_ENTRA_API_SCOPE || (client_id ? `api://${client_id}/access_as_user` : "")

export const entra_enabled = Boolean(entra_enabled_flag && tenant_id && client_id && authority && api_scope)

let msal_client_promise = null


async function get_msal_client() {
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


export async function bootstrap_entra_token() {
  const client = await get_msal_client()
  if (!client) {
    return null
  }

  const redirect_result = await client.handleRedirectPromise()
  if (redirect_result?.account) {
    client.setActiveAccount(redirect_result.account)
  }

  const account = ensure_active_account(client)
  if (!account) {
    return null
  }

  const token_response = await client.acquireTokenSilent({
    account,
    scopes: [api_scope],
  })

  return token_response.accessToken
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
