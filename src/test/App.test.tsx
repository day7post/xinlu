import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { clearLocalData } from '../lib/db'

describe('MVP 记录闭环', () => {
  beforeEach(async () => {
    await clearLocalData()
  })

  it('可以创建第一枚心锚并进入详情', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByRole('heading', { name: '留下一句话就够了' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '写下第一枚心锚' }))
    const editor = await screen.findByPlaceholderText('现在想起什么，就写什么。')
    await user.type(editor, '我第一次真正记住这天的风。')
    await user.click(screen.getByRole('button', { name: '完成' }))

    expect(await screen.findByRole('heading', { name: '我第一次真正记住这天的风。' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /连一条心线/ })).toBeInTheDocument()
  })
})


