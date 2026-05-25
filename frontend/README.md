# Frontend

This frontend is a React + Vite single-page application for the Billing Collaboration Platform.

## Purpose

The UI supports:

- authentication and signup request submission
- role-based navigation
- billing cycle creation
- script generation and export
- run tracking
- finance approval workflows
- request settings management
- notification command generation
- embedded operational documentation
- admin user and signup-request management

## Main Source Files

- `src/main.jsx`: app bootstrap
- `src/App.jsx`: main application UI and state management
- `src/api.js`: API base URL and authenticated fetch helpers
- `src/App.css`: component-level styles
- `src/index.css`: base tokens and global styles

## Current Architecture Notes

- the app does not use a router; screen switching is local state-driven
- most application logic is concentrated in `src/App.jsx`
- the frontend polls backend data every 30 seconds after login
- markdown docs from `docs/platform/` are rendered directly in the UI

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Environment Variables

- `VITE_API_URL`: backend API base URL
- `VITE_APPROVAL_WEBHOOK_URL`: optional frontend-side approval link setting

If `VITE_API_URL` is not set, the code currently defaults to:

```text
http://localhost:8001/api
```
