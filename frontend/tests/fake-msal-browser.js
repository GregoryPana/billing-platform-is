// Deterministic MSAL test double for `tests/entra-auth-mode.mjs`.
const scenarios = {
  no_session: {
    handleRedirectPromise: async () => ({ account: null }),
    getActiveAccount: () => null,
    getAllAccounts: () => [],
    acquireTokenSilent: async () => { throw new Error('No account') },
    loginRedirect: async () => { window.__entraTestLoginRedirectCalled = true },
    logoutRedirect: async () => {},
  },
  existing_session: {
    handleRedirectPromise: async () => ({ account: { username: 'test@cws.sc' } }),
    getActiveAccount: () => ({ username: 'test@cws.sc' }),
    getAllAccounts: () => [{ username: 'test@cws.sc' }],
    acquireTokenSilent: async () => ({ accessToken: 'fake-entra-access-token' }),
    loginRedirect: async () => { throw new Error('loginRedirect should not be called for an existing session') },
    logoutRedirect: async () => {},
  },
  interaction_required: {
    handleRedirectPromise: async () => ({ account: null }),
    getActiveAccount: () => ({ username: 'interaction@cws.sc' }),
    getAllAccounts: () => [{ username: 'interaction@cws.sc' }],
    acquireTokenSilent: async () => {
      const error = new Error('interaction_required')
      error.errorCode = 'interaction_required'
      error.name = 'InteractionRequiredAuthError'
      throw error
    },
    loginRedirect: async () => { window.__entraTestLoginRedirectCalled = true },
    logoutRedirect: async () => {},
  },
}

function PublicClientApplication(config) {
  this.config = config
  Object.assign(this, scenarios[window.__entraTestScenario] || scenarios.no_session)
  this.setActiveAccount = () => {}
}

PublicClientApplication.createPublicClientApplication = async config => new PublicClientApplication(config)

class InteractionRequiredAuthError extends Error {
  constructor(message) {
    super(message)
    this.name = 'InteractionRequiredAuthError'
    this.errorCode = 'interaction_required'
  }
}

export { PublicClientApplication, InteractionRequiredAuthError }
