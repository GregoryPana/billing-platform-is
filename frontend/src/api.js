const DEFAULT_API_URL = "http://localhost:8000/api"

export const api_base_url = import.meta.env.VITE_API_URL || DEFAULT_API_URL
export const approval_webhook_url = import.meta.env.VITE_APPROVAL_WEBHOOK_URL || ""

const auth_storage_key = "billing_auth_token"

export function set_auth_token(token) {
  if (token) {
    localStorage.setItem(auth_storage_key, token)
  } else {
    localStorage.removeItem(auth_storage_key)
  }
}

export function get_auth_token() {
  return localStorage.getItem(auth_storage_key)
}

export function api_headers(headers = {}, include_auth = true) {
  const next_headers = new Headers(headers)
  if (include_auth) {
    const token = get_auth_token()
    if (token) {
      next_headers.set("Authorization", `Bearer ${token}`)
    }
  }
  return next_headers
}

export async function api_fetch(path, options = {}, include_auth = true) {
  const headers = api_headers(options.headers, include_auth)
  headers.set("Content-Type", "application/json")

  const response = await fetch(`${api_base_url}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || "Request failed")
  }

  return response.json()
}
