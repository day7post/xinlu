import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from '../components/ErrorBoundary'

function BrokenChild(): never {
  throw new Error('测试用渲染错误')
}

describe('ErrorBoundary', () => {
  it('子组件抛错时显示恢复页而不是白屏', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(
      <ErrorBoundary>
        <BrokenChild />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('heading', { name: '这一页没能打开' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /回到时间轴/ })).toBeInTheDocument()
    expect(screen.getByText('测试用渲染错误')).toBeInTheDocument()
    spy.mockRestore()
  })

  it('子组件正常时原样渲染', () => {
    render(
      <ErrorBoundary>
        <p>一切正常</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('一切正常')).toBeInTheDocument()
  })
})
