import { BookOpenText } from 'lucide-react'

export function LoadingScreen({ label = '正在打开你的心图' }: { label?: string }) {
  return (
    <div className="loading-screen">
      <span className="brand-mark large" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <BookOpenText size={20} />
      <p>{label}</p>
    </div>
  )
}
