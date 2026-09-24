import { useEffect, useState } from 'react'
import { BookOpenText, Database, Home, Plus, Search, Settings, WifiOff } from 'lucide-react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useVault } from '../state/VaultContext'

const navItems = [
  { to: '/', label: '时间轴', icon: Home, end: true },
  { to: '/search', label: '查找', icon: Search, end: false },
  { to: '/settings', label: '资料', icon: Settings, end: false },
]

export function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const { data, createDraft } = useVault()
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [location.pathname])

  const createAnchor = () => {
    const anchorId = createDraft()
    if (anchorId) navigate(`/editor/${anchorId}`)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="主导航">
        <button className="brand" type="button" onClick={() => navigate('/')}>
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>
            <strong>心络</strong>
            <small>记忆有来处</small>
          </span>
        </button>
        <nav className="side-nav">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon size={19} strokeWidth={1.8} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="privacy-note">
          <Database size={17} />
          <span>只保存在这台设备</span>
          <small>{data ? `${data.anchors.filter((anchor) => !anchor.deletedAt && anchor.status === 'active').length} 枚心锚` : '准备中'}</small>
        </div>
      </aside>

      <main className="app-main">
        {!online && (
          <div className="offline-banner">
            <WifiOff size={15} />
            当前离线，记录仍会保存在本机
          </div>
        )}
        <Outlet />
      </main>

      <nav className="mobile-nav" aria-label="移动端主导航">
        {navItems.slice(0, 2).map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon size={20} strokeWidth={1.8} />
            <span>{label}</span>
          </NavLink>
        ))}
        <button className="mobile-create" type="button" onClick={createAnchor} aria-label="写下心锚">
          <Plus size={25} />
        </button>
        {navItems.slice(2).map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon size={20} strokeWidth={1.8} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <button className="desktop-create" type="button" onClick={createAnchor}>
        <Plus size={20} />
        <span>写下心锚</span>
        <BookOpenText size={17} />
      </button>
    </div>
  )
}

