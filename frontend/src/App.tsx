import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Onboarding from './pages/Onboarding'
import JobsLanding from './pages/JobsLanding'
import JobsList from './pages/JobsList'
import FindLanding from './pages/FindLanding'
import ApiSearch from './pages/ApiSearch'
import ScrapeSearch from './pages/ScrapeSearch'
import CoverLetterEditor from './pages/CoverLetterEditor'
import Tracker from './pages/Tracker'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/jobs" element={<JobsLanding />} />
          <Route path="/jobs/list" element={<JobsList />} />
          <Route path="/jobs/find" element={<FindLanding />} />
          <Route path="/jobs/find/api" element={<ApiSearch />} />
          <Route path="/jobs/find/scrape" element={<ScrapeSearch />} />
          <Route path="/cover-letters" element={<CoverLetterEditor />} />
          <Route path="/tracker" element={<Tracker />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
