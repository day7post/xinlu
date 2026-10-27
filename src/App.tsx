import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { LoadingScreen } from './components/LoadingScreen'
import { VaultProvider } from './state/VaultContext'

const AnchorDetailPage = lazy(() =>
  import('./pages/AnchorDetailPage').then((module) => ({ default: module.AnchorDetailPage })),
)
const ConnectPage = lazy(() =>
  import('./pages/ConnectPage').then((module) => ({ default: module.ConnectPage })),
)
const EditorPage = lazy(() =>
  import('./pages/EditorPage').then((module) => ({ default: module.EditorPage })),
)
const HeartlineDetailPage = lazy(() =>
  import('./pages/HeartlineDetailPage').then((module) => ({ default: module.HeartlineDetailPage })),
)
const HistoryPage = lazy(() =>
  import('./pages/HistoryPage').then((module) => ({ default: module.HistoryPage })),
)
const SearchPage = lazy(() =>
  import('./pages/SearchPage').then((module) => ({ default: module.SearchPage })),
)
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })),
)
const TimelinePage = lazy(() =>
  import('./pages/TimelinePage').then((module) => ({ default: module.TimelinePage })),
)
const GraphPage = lazy(() =>
  import('./pages/GraphPage').then((module) => ({ default: module.GraphPage })),
)

function App() {
  return (
    <VaultProvider>
      <BrowserRouter basename="/xinlu">
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/editor/:anchorId" element={<EditorPage />} />
            <Route element={<AppShell />}>
              <Route index element={<TimelinePage />} />
              <Route path="/graph" element={<GraphPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/anchor/:anchorId" element={<AnchorDetailPage />} />
              <Route path="/anchor/:anchorId/history" element={<HistoryPage />} />
              <Route path="/connect/:anchorId" element={<ConnectPage />} />
              <Route path="/line/:lineId" element={<HeartlineDetailPage />} />
              <Route path="*" element={<TimelinePage />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </VaultProvider>
  )
}

export default App
