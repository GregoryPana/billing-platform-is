import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { RouteErrorBoundary } from '../src/components/layout/RouteErrorBoundary'
import '../src/App.css'

export function FailingRoute() {
  throw new Error('Synthetic lazy-route failure')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouteErrorBoundary>
      <FailingRoute />
    </RouteErrorBoundary>
  </StrictMode>,
)
