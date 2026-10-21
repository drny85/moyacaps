"use client";

import React from "react";

/**
 * Catches a failed Convex query (`useQuery` throws) and renders `fallback(retry)`.
 * Retry remounts the children, which subscribes to the query again.
 */
export class QueryErrorBoundary extends React.Component<
  { fallback: (retry: () => void) => React.ReactNode; children: React.ReactNode },
  { failed: boolean; attempt: number }
> {
  state = { failed: false, attempt: 0 };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Admin query failed", error);
  }

  retry = () => this.setState((s) => ({ failed: false, attempt: s.attempt + 1 }));

  render() {
    if (this.state.failed) return this.props.fallback(this.retry);
    return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>;
  }
}
