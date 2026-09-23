import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Globe, Bug } from 'lucide-react'

export default function FindLanding() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh]">
      <button
        onClick={() => navigate('/jobs')}
        className="self-start mb-8 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">Find Jobs</h1>
      <p className="text-gray-500 mb-12">Choose your search method</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl">
        <button
          onClick={() => navigate('/find/api')}
          className="group flex flex-col items-center justify-center gap-4 bg-white border-2 border-gray-200 rounded-2xl p-12 hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer"
        >
          <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
            <Globe size={32} className="text-blue-600" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">API Search</h2>
            <p className="text-sm text-gray-500 mt-2">Search via JSearch and Adzuna</p>
            <p className="text-xs text-gray-400 mt-1">Structured results, fast and reliable</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/find/boards')}
          className="group flex flex-col items-center justify-center gap-4 bg-white border-2 border-gray-200 rounded-2xl p-12 hover:border-amber-500 hover:shadow-lg transition-all cursor-pointer"
        >
          <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
            <Bug size={32} className="text-amber-600" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 group-hover:text-amber-600 transition-colors">Scrape Search</h2>
            <p className="text-sm text-gray-500 mt-2">Scrape job boards directly</p>
            <p className="text-xs text-gray-400 mt-1">Greenhouse, Lever, LinkedIn and more</p>
          </div>
        </button>
      </div>
    </div>
  )
}
