"use client";

import { useState, useEffect, useRef } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

export interface LocationResult {
  address: string
  longitude: number
  latitude: number
  type: 'address' | 'city' | 'region' | 'country'
  bbox?: [number, number, number, number] // [minX, minY, maxX, maxY]
}

interface LocationSearchProps {
  onLocationSelected: (location: LocationResult) => void
  placeholder?: string
  className?: string
}

export function LocationSearch({
  onLocationSelected,
  placeholder = "Search for a location...",
  className = ""
}: LocationSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LocationResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const resultsContainerRef = useRef<HTMLDivElement>(null)

  const geocodeLocation = async (searchText: string) => {
    if (!searchText.trim()) return []
    
    setIsLoading(true)
    
    try {
      // Use ArcGIS geocoding service
      const apiKey = process.env.NEXT_PUBLIC_ARCGIS_API_KEY
      const url = `https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&singleLine=${encodeURIComponent(searchText)}&outFields=Match_addr,Addr_type&maxLocations=5&outSR=4326&token=${apiKey}`
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.candidates && data.candidates.length > 0) {
        return data.candidates.map((candidate: any) => ({
          address: candidate.address,
          longitude: candidate.location.x,
          latitude: candidate.location.y,
          type: determineLocationType(candidate),
          bbox: candidate.extent ? [
            candidate.extent.xmin,
            candidate.extent.ymin,
            candidate.extent.xmax,
            candidate.extent.ymax
          ] : undefined
        }))
      }
      
      return []
    } catch (error) {
      console.error("Error geocoding location:", error)
      return []
    } finally {
      setIsLoading(false)
    }
  }
  
  const determineLocationType = (candidate: any): LocationResult['type'] => {
    const addrType = candidate.attributes?.Addr_type
    if (!addrType) return 'address'
    
    if (addrType.includes('Country')) return 'country'
    if (addrType.includes('Region') || addrType.includes('State')) return 'region'
    if (addrType.includes('City')) return 'city'
    return 'address'
  }
  
  const handleSearch = async () => {
    if (!query.trim()) return
    const searchResults = await geocodeLocation(query)
    setResults(searchResults)
    setShowResults(true)
  }
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }
  
  const handleSelectLocation = (location: LocationResult) => {
    onLocationSelected(location)
    setQuery(location.address)
    setShowResults(false)
  }
  
  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        resultsContainerRef.current && 
        !resultsContainerRef.current.contains(e.target as Node)
      ) {
        setShowResults(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])
  
  return (
    <div className={`relative ${className}`} ref={resultsContainerRef}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            type="text"
            value={query}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="pr-10 text-xs placeholder:text-xs"
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 size={18} className="animate-spin text-gray-400" />
            </div>
          )}
        </div>
        <Button onClick={handleSearch} size="icon" variant="secondary">
          <Search size={18} />
        </Button>
      </div>
      
      {showResults && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border shadow-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
          <ul className="py-1">
            {results.map((result, index) => (
              <li 
                key={index}
                className="cursor-pointer px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                onClick={() => handleSelectLocation(result)}
              >
                <div className="text-xs font-medium text-gray-900 dark:text-gray-100">{result.address}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {result.type.charAt(0).toUpperCase() + result.type.slice(1)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
} 