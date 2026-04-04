'use client'

import { Search, CheckCircle2 } from 'lucide-react'

interface SearchSource {
  title: string
  link: string
}

interface SearchStatusProps {
  isSearching: boolean
  sources: SearchSource[]
}

export function SearchStatus({ isSearching, sources }: SearchStatusProps) {
  if (!isSearching && sources.length === 0) {
    return null
  }

  return (
    <div className="rounded-lg p-4 mb-4" style={{ backgroundColor: '#222423', border: '1px solid #333333' }}>
      {isSearching && (
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-[#e0521d] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-400">Buscando na web...</span>
          </div>
        </div>
      )}

      {sources.length > 0 && (
        <div className="space-y-2">
          {sources.map((source, index) => (
            <div key={index} className="flex items-start gap-2">
              <CheckCircle2 size={16} className="text-[#10b981] mt-0.5 flex-shrink-0" />
              <a
                href={source.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#e0521d] hover:underline break-all"
                title={source.title}
              >
                {source.title || source.link}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
