import { Component } from "react"

/* Catches lazy-chunk load failures (e.g. stale deploy, offline) without breaking the whole app shell. */
export class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { has_error: false }
  }

  static getDerivedStateFromError() {
    return { has_error: true }
  }

  componentDidCatch(error) {
    console.error("Route failed to load", error)
  }

  handle_retry = () => {
    this.setState({ has_error: false })
    window.location.reload()
  }

  render() {
    if (this.state.has_error) {
      return (
        <div
          className="flex min-h-[240px] w-full flex-col items-center justify-center gap-3 p-8 text-center"
          role="alert"
        >
          <p className="text-sm text-muted-foreground">This page failed to load. Please try again.</p>
          <button type="button" className="secondary-button" onClick={this.handle_retry}>
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
