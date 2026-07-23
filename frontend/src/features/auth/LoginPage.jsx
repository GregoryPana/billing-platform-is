import { useState } from "react"

import { api_fetch, set_auth_token } from "../../api"
import { entra_enabled, sign_in_with_entra } from "../../entra"
import { is_valid_email } from "../../lib/format"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"

export function LoginPage({ on_authenticated }) {
  const [auth_mode, set_auth_mode] = useState("login")
  const [login_form, set_login_form] = useState({ username_or_email: "", password: "" })
  const [show_login_password, set_show_login_password] = useState(false)
  const [signup_form, set_signup_form] = useState({ name: "", username: "", email: "", password: "" })
  const [signup_status, set_signup_status] = useState("")
  const [error_message, set_error_message] = useState("")

  const handle_login_submit = async (event) => {
    event.preventDefault()
    try {
      set_error_message("")
      const login_identifier = login_form.username_or_email.trim()
      if (login_identifier.includes("@") && !is_valid_email(login_identifier)) {
        set_error_message("Enter a valid email address or use your username instead.")
        return
      }
      const response = await api_fetch("/auth/login", { method: "POST", body: JSON.stringify(login_form) }, false)
      set_auth_token(response.access_token)
      set_signup_status("")
      on_authenticated(response.user)
    } catch (error) {
      const message = error?.message || "Sign in failed"
      if (message.includes("Invalid credentials") || message.includes("invalid credentials")) {
        set_error_message("Incorrect username/email or password.")
        return
      }
      set_error_message(message)
    }
  }

  const handle_signup_submit = async (event) => {
    event.preventDefault()
    try {
      set_error_message("")
      const response = await api_fetch("/auth/signup", { method: "POST", body: JSON.stringify(signup_form) }, false)
      set_signup_status(`Request submitted for ${response.username}. Admin has been notified and will review shortly.`)
      set_auth_mode("login")
      set_signup_form({ name: "", username: "", email: "", password: "" })
    } catch (error) {
      set_error_message(error.message)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-[440px] flex-col gap-8 rounded-lg border border-transparent bg-card p-8 shadow-sm dark:border-border">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Billing Platform</h1>
          <p className="mt-2 text-sm text-muted-foreground">Automated billing operations and approvals</p>
        </div>

        <div className="space-y-1 text-center">
          <h2 className="text-xl font-semibold tracking-tight">
            {auth_mode === "login" ? "Sign in to account" : "Request access"}
          </h2>
          <p className="text-[13px] text-muted-foreground">
            {auth_mode === "login"
              ? "Enter your core credentials to continue."
              : "Admin approval is required for all new accounts."}
          </p>
        </div>

        {entra_enabled && auth_mode === "login" ? (
          <div className="grid gap-3">
            <Button onClick={() => sign_in_with_entra().catch((error) => set_error_message(error.message))}>
              Sign In With Microsoft
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Recommended for production access. Local sign-in remains available during migration.
            </p>
          </div>
        ) : null}

        {error_message && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs font-medium text-destructive">
            {error_message}
          </div>
        )}
        {signup_status && (
          <div className="rounded-md border border-success/50 bg-success/10 p-3 text-xs font-medium text-success">
            {signup_status}
          </div>
        )}

        <form className="grid gap-6" onSubmit={auth_mode === "login" ? handle_login_submit : handle_signup_submit}>
          {auth_mode === "signup" && (
            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <Label>Full name</Label>
                <Input
                  placeholder="John Doe"
                  value={signup_form.name}
                  onChange={(e) => set_signup_form({ ...signup_form, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Username</Label>
                <Input
                  placeholder="jdoe123"
                  value={signup_form.username}
                  onChange={(e) => set_signup_form({ ...signup_form, username: e.target.value })}
                  required
                />
              </div>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label>Email or username</Label>
            <Input
              type="text"
              placeholder="name@cwseychelles.com"
              value={auth_mode === "login" ? login_form.username_or_email : signup_form.email}
              onChange={(e) =>
                auth_mode === "login"
                  ? set_login_form({ ...login_form, username_or_email: e.target.value })
                  : set_signup_form({ ...signup_form, email: e.target.value })
              }
              required
            />
          </div>

          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label>Password</Label>
              {auth_mode === "login" && (
                <button
                  type="button"
                  onClick={() => set_show_login_password(!show_login_password)}
                  className="text-xs font-medium text-foreground hover:underline"
                >
                  {show_login_password ? "Hide" : "Show"}
                </button>
              )}
            </div>
            <Input
              type={auth_mode === "login" && show_login_password ? "text" : "password"}
              value={auth_mode === "login" ? login_form.password : signup_form.password}
              onChange={(e) =>
                auth_mode === "login"
                  ? set_login_form({ ...login_form, password: e.target.value })
                  : set_signup_form({ ...signup_form, password: e.target.value })
              }
              required
            />
          </div>

          <Button type="submit">{auth_mode === "login" ? "Sign In" : "Submit Request"}</Button>
        </form>

        <div className="flex flex-col gap-4 border-t pt-8 text-center">
          <button
            className="text-sm font-bold text-primary transition-opacity hover:underline hover:opacity-80"
            type="button"
            onClick={() => {
              set_auth_mode(auth_mode === "login" ? "signup" : "login")
              set_error_message("")
              set_signup_status("")
            }}
          >
            {auth_mode === "login" ? "Request account access" : "Back to sign in"}
          </button>
          {auth_mode === "login" && (
            <span className="pointer-events-none text-xs text-muted-foreground opacity-70">Authorized personnel only</span>
          )}
        </div>
      </div>
    </div>
  )
}
