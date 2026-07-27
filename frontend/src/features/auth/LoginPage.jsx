import { useState } from "react"

import { api_fetch, set_auth_token } from "../../api"
import { entra_enabled, sign_in_with_entra } from "../../entra"
import { is_valid_email } from "../../lib/format"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"

export function LoginPage({ on_authenticated }) {
  const [login_form, set_login_form] = useState({ username_or_email: "", password: "" })
  const [show_login_password, set_show_login_password] = useState(false)
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-[440px] flex-col gap-8 rounded-lg border border-transparent bg-card p-8 shadow-sm dark:border-border">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Billing Platform</h1>
          <p className="mt-2 text-sm text-muted-foreground">Automated billing operations and approvals</p>
        </div>

        <div className="space-y-1 text-center">
          <h2 className="text-xl font-semibold tracking-tight">Sign in to account</h2>
          <p className="text-[13px] text-muted-foreground">Enter your core credentials to continue.</p>
        </div>

        {entra_enabled ? (
          <div className="grid gap-3">
            <Button onClick={() => sign_in_with_entra().catch((error) => set_error_message(error.message))}>
              Sign In With Microsoft
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Recommended for production access. Local sign-in is reserved for emergency access.
            </p>
          </div>
        ) : null}

        {error_message && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs font-medium text-destructive">
            {error_message}
          </div>
        )}

        <form className="grid gap-6" onSubmit={handle_login_submit}>
          <div className="grid gap-1.5">
            <Label>Email or username</Label>
            <Input
              type="text"
              placeholder="name@cwseychelles.com"
              value={login_form.username_or_email}
              onChange={(e) => set_login_form({ ...login_form, username_or_email: e.target.value })}
              required
            />
          </div>

          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label>Password</Label>
              <button
                type="button"
                onClick={() => set_show_login_password(!show_login_password)}
                className="text-xs font-medium text-foreground hover:underline"
              >
                {show_login_password ? "Hide" : "Show"}
              </button>
            </div>
            <Input
              type={show_login_password ? "text" : "password"}
              value={login_form.password}
              onChange={(e) => set_login_form({ ...login_form, password: e.target.value })}
              required
            />
          </div>

          <Button type="submit">Sign In</Button>
        </form>

        <div className="flex flex-col gap-4 border-t pt-8 text-center">
          <span className="pointer-events-none text-xs text-muted-foreground opacity-70">Authorized personnel only</span>
        </div>
      </div>
    </div>
  )
}
