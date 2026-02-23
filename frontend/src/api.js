const DEFAULT_API_URL = "http://localhost:8000/api"

export const api_base_url = import.meta.env.VITE_API_URL || DEFAULT_API_URL
export const approval_webhook_url = import.meta.env.VITE_APPROVAL_WEBHOOK_URL || ""

export function api_headers(headers = {}) {
  const next_headers = new Headers(headers)
  return next_headers
}

export async function api_fetch(path, options = {}) {
  const headers = api_headers(options.headers)
  headers.set("Content-Type", "application/json")

  const response = await fetch(`${api_base_url}${path}`, {
    ...options,
    headers,
    credentials: "include",
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || "Request failed")
  }

  return response.json()
}
