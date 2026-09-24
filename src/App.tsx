import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { AnchorDetailPage } from './pages/AnchorDetailPage'
import { ConnectPage } from './pages/ConnectPage'
import { EditorPage } from './pages/EditorPage'
import { HeartlineDetailPage } from './pages/HeartlineDetailPage'
import { HistoryPage } from './pages/HistoryPage'
import { SearchPage } from './pages/SearchPage'
import { SettingsPage } from './pages/SettingsPage'
import { TimelinePage } from './pages/TimelinePage'
import { VaultProvider } from './state/VaultContext'

function App() {
  return (
    <VaultProvider>
      <BrowserRouter basename="/xinlu">
        <Routes>
          <Route path="/editor/:anchorId" element={<EditorPage />} />
          <Route element={<AppShell />}>
            <Route index element={<TimelinePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/anchor/:anchorId" element={<AnchorDetailPage />} />
            <Route path="/anchor/:anchorId/history" element={<HistoryPage />} />
            <Route path="/connect/:anchorId" element={<ConnectPage />} />
            <Route path="/line/:lineId" element={<HeartlineDetailPage />} />
            <Route path="*" element={<TimelinePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </VaultProvider>
  )
}

export default App
