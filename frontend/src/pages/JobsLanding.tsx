import { useNavigate } from 'react-router-dom'
import { Briefcase, Search, Send } from 'lucide-react'

export default function JobsLanding() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh]">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Jobs</h1>
      <p className="text-gray-500 mb-12">What would you like to do?</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl">
        <button
          onClick={() => navigate('/jobs/list')}
          className="group flex flex-col items-center justify-center gap-4 bg-white border-2 border-gray-200 rounded-2xl p-12 hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer"
        >
          <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
            <Briefcase size={32} className="text-blue-600" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">Jobs</h2>
            <p className="text-sm text-gray-500 mt-1">View and manage saved jobs</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/jobs/find')}
          className="group flex flex-col items-center justify-center gap-4 bg-white border-2 border-gray-200 rounded-2xl p-12 hover:border-emerald-500 hover:shadow-lg transition-all cursor-pointer"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
            <Search size={32} className="text-emerald-600" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 group-hover:text-emerald-600 transition-colors">Find</h2>
            <p className="text-sm text-gray-500 mt-1">Discover new job opportunities</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/apply')}
          className="group flex flex-col items-center justify-center gap-4 bg-white border-2 border-gray-200 rounded-2xl p-12 hover:border-indigo-500 hover:shadow-lg transition-all cursor-pointer"
        >
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
            <Send size={32} className="text-indigo-600" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">Apply</h2>
            <p className="text-sm text-gray-500 mt-1">Run assisted applications queue</p>
          </div>
        </button>
      </div>
    </div>
  )
}
