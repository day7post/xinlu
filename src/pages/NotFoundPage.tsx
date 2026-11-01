import { Compass } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <div className="page error-page">
      <span className="error-icon">
        <Compass size={22} />
      </span>
      <h1>这条路还没有心锚</h1>
      <p>这个地址不存在，可能链接写错了，或者那枚心锚已经被移走。</p>
      <div className="error-actions">
        <button className="primary-button" type="button" onClick={() => navigate('/')}>
          回到时间轴
        </button>
      </div>
    </div>
  )
}
