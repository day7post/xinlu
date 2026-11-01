import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('心络页面渲染出错', error, info)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="error-page">
        <span className="error-icon">
          <AlertTriangle size={22} />
        </span>
        <h1>这一页没能打开</h1>
        <p>你的资料都保存在这台设备上，不会因为这个错误丢失。可以先回到时间轴，或者刷新一次试试。</p>
        <p className="error-detail">{error.message}</p>
        <div className="error-actions">
          <button
            className="primary-button"
            type="button"
            onClick={() => window.location.assign(import.meta.env.BASE_URL)}
          >
            <Home size={16} />
            回到时间轴
          </button>
          <button className="secondary-button" type="button" onClick={() => window.location.reload()}>
            <RefreshCw size={16} />
            刷新页面
          </button>
        </div>
      </div>
    )
  }
}
