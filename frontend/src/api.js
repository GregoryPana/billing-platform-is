const DEFAULT_API_URL = "http://localhost:8000/api"

export const api_base_url = import.meta.env.VITE_API_URL || DEFAULT_API_URL

export async function api_fetch(path, options = {}, role = "billing") {
  const headers = new Headers(options.headers || {})
  headers.set("Content-Type", "application/json")
  headers.set("x-user-id", "00000000-0000-0000-0000-000000000001")
  headers.set("x-user-role", role)

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
