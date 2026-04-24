import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import JobBoard from './pages/JobBoard.jsx'
import JobDetail from './pages/JobDetail.jsx'
import Profile from './pages/Profile.jsx'
import Employer from './pages/Employer.jsx'

export default function App() {
  return (
    <BrowserRouter basename="/platform">
      <Routes>
        <Route path="/" element={<JobBoard />} />
        <Route path="/job/:id" element={<JobDetail />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/employer" element={<Employer />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
