import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import Today from './pages/Today'
import Profile from './pages/Profile'
import JobsList from './pages/JobsList'
import Find from './pages/Find'
import QuickApply from './pages/QuickApply'
import Letters from './pages/Letters'
import Tracker from './pages/Tracker'

/** Keep old bookmarks and in-app links working, including their query strings. */
function Redirect({ to }: { to: string }) {
  const { search } = useLocation()
  return <Navigate to={`${to}${search}`} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Today />} />
          <Route path="/jobs" element={<JobsList />} />
          <Route path="/find" element={<Find />} />
          <Route path="/apply" element={<QuickApply />} />
          <Route path="/letters" element={<Letters />} />
          <Route path="/tracker" element={<Tracker />} />
          <Route path="/profile" element={<Profile />} />

          <Route path="/onboarding" element={<Redirect to="/profile" />} />
          <Route path="/jobs/list" element={<Redirect to="/jobs" />} />
          <Route path="/jobs/find" element={<Redirect to="/find" />} />
          <Route path="/jobs/find/api" element={<Navigate to="/find?tab=api" replace />} />
          <Route path="/jobs/find/scrape" element={<Navigate to="/find?tab=boards" replace />} />
          <Route path="/cover-letters" element={<Redirect to="/letters" />} />
          <Route path="*" element={<Redirect to="/" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
