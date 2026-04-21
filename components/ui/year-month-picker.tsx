"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface YearMonthPickerProps {
  date?: Date
  onDateChange?: (date: Date) => void
  className?: string
  fromYear?: number
  toYear?: number
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

export function YearMonthPicker({
  date = new Date(),
  onDateChange,
  className,
  fromYear = 1900,
  toYear = new Date().getFullYear()
}: YearMonthPickerProps) {
  const [selectedYear, setSelectedYear] = React.useState(date.getFullYear())
  const [selectedMonth, setSelectedMonth] = React.useState(date.getMonth())

  const years = Array.from({ length: toYear - fromYear + 1 }, (_, i) => fromYear + i)

  const updateDate = React.useCallback((year: number, month: number) => {
    const newDate = new Date(year, month, date.getDate())
    onDateChange?.(newDate)
  }, [date, onDateChange])

  const handleYearChange = (year: string) => {
    const yearNum = parseInt(year, 10)
    setSelectedYear(yearNum)
    updateDate(yearNum, selectedMonth)
  }

  const handleMonthChange = (month: string) => {
    const monthNum = parseInt(month, 10)
    setSelectedMonth(monthNum)
    updateDate(selectedYear, monthNum)
  }

  const goToPreviousMonth = () => {
    if (selectedMonth === 0) {
      setSelectedYear(selectedYear - 1)
      setSelectedMonth(11)
      updateDate(selectedYear - 1, 11)
    } else {
      setSelectedMonth(selectedMonth - 1)
      updateDate(selectedYear, selectedMonth - 1)
    }
  }

  const goToNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedYear(selectedYear + 1)
      setSelectedMonth(0)
      updateDate(selectedYear + 1, 0)
    } else {
      setSelectedMonth(selectedMonth + 1)
      updateDate(selectedYear, selectedMonth + 1)
    }
  }

  React.useEffect(() => {
    setSelectedYear(date.getFullYear())
    setSelectedMonth(date.getMonth())
  }, [date])

  return (
    <div className={cn("flex flex-col space-y-4 p-4", className)}>
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={goToPreviousMonth}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <div className="text-sm font-medium">
          {MONTHS[selectedMonth]} {selectedYear}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={goToNextMonth}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Year and Month Selectors */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Year
          </label>
          <Select value={selectedYear.toString()} onValueChange={handleYearChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {years.reverse().map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Month
          </label>
          <Select value={selectedMonth.toString()} onValueChange={handleMonthChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((month, index) => (
                <SelectItem key={index} value={index.toString()}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const thisMonth = new Date()
            setSelectedYear(thisMonth.getFullYear())
            setSelectedMonth(thisMonth.getMonth())
            updateDate(thisMonth.getFullYear(), thisMonth.getMonth())
          }}
        >
          This Month
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const lastMonth = new Date()
            lastMonth.setMonth(lastMonth.getMonth() - 1)
            setSelectedYear(lastMonth.getFullYear())
            setSelectedMonth(lastMonth.getMonth())
            updateDate(lastMonth.getFullYear(), lastMonth.getMonth())
          }}
        >
          Last Month
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const lastYear = new Date()
            lastYear.setFullYear(lastYear.getFullYear() - 1)
            setSelectedYear(lastYear.getFullYear())
            setSelectedMonth(lastYear.getMonth())
            updateDate(lastYear.getFullYear(), lastYear.getMonth())
          }}
        >
          Last Year
        </Button>
      </div>
    </div>
  )
}