const DEFAULT_API_URL = "http://localhost:8000/api"

export const api_base_url = import.meta.env.VITE_API_URL || DEFAULT_API_URL
export const approval_webhook_url = import.meta.env.VITE_APPROVAL_WEBHOOK_URL || ""
export const default_user_id = "00000000-0000-0000-0000-000000000001"

export function api_headers(role = "billing", headers = {}) {
  const next_headers = new Headers(headers)
  next_headers.set("x-user-id", default_user_id)
  next_headers.set("x-user-role", role)
  return next_headers
}

export async function api_fetch(path, options = {}, role = "billing") {
  const headers = api_headers(role, options.headers)
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
