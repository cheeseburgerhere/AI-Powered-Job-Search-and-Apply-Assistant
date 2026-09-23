import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Onboarding from './pages/Onboarding'
import JobsList from './pages/JobsList'
import FindLanding from './pages/FindLanding'
import ApiSearch from './pages/ApiSearch'
import ScrapeSearch from './pages/ScrapeSearch'
import QuickApply from './pages/QuickApply'
import CoverLetterEditor from './pages/CoverLetterEditor'
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
          <Route path="/" element={<Dashboard />} />
          <Route path="/jobs" element={<JobsList />} />
          <Route path="/find" element={<FindLanding />} />
          <Route path="/find/api" element={<ApiSearch />} />
          <Route path="/find/boards" element={<ScrapeSearch />} />
          <Route path="/apply" element={<QuickApply />} />
          <Route path="/letters" element={<CoverLetterEditor />} />
          <Route path="/tracker" element={<Tracker />} />
          <Route path="/profile" element={<Onboarding />} />

          <Route path="/onboarding" element={<Redirect to="/profile" />} />
          <Route path="/jobs/list" element={<Redirect to="/jobs" />} />
          <Route path="/jobs/find" element={<Redirect to="/find" />} />
          <Route path="/jobs/find/api" element={<Redirect to="/find/api" />} />
          <Route path="/jobs/find/scrape" element={<Redirect to="/find/boards" />} />
          <Route path="/cover-letters" element={<Redirect to="/letters" />} />
          <Route path="*" element={<Redirect to="/" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
