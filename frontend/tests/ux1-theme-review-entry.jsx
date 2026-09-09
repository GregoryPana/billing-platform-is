import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { ThemeReviewPage } from '../src/features/dev/ThemeReviewPage'
import '../src/App.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeReviewPage />
  </StrictMode>,
)
