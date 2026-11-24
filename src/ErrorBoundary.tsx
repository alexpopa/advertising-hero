/**
 * Shows a plain card instead of a blank page when something throws while rendering. The usual
 * cause is a browser that can't run WebGL 2, which the map needs.
 */
import { Component, type ReactNode } from "react";

function hasWebGL2(): boolean {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const noMap = !hasWebGL2();
    return (
      <div className="shell">
        <div className="float-card center-card crash" role="alert">
          <span className="crash-icon" aria-hidden>
            🗺️
          </span>
          <h2>{noMap ? "Your browser can't draw the map" : "Something went wrong"}</h2>
          <p>
            {noMap
              ? "It needs WebGL 2. Turn on hardware acceleration in your browser's settings, or try an up-to-date Chrome, Edge, Firefox or Safari."
              : "Your game is saved in this browser up to the last change."}
          </p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            {noMap ? "Try again" : "Reload"}
          </button>
        </div>
      </div>
    );
  }
}
