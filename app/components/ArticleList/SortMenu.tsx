"use client"

import { ArrowUpDown, ArrowDown, ArrowUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"

export type SortOption = 'default' | 'oldest'

interface SortMenuProps {
  sortBy: SortOption
  onSortChange: (sort: SortOption) => void
}

export default function SortMenu({ sortBy, onSortChange }: SortMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center space-x-1 bg-white shadow-md hover:shadow-lg hover:-translate-y-0.5 dark:bg-gray-800 dark:shadow-gray-900/20 dark:hover:bg-gray-700 transition-all duration-200"
          title="排序"
        >
          <ArrowUpDown className="h-4 w-4" />
          <span className="hidden sm:inline">
            {sortBy === 'default' ? '默认排序' : '按时间从旧到新'}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={() => onSortChange('default')}
          className={sortBy === 'default' ? 'bg-gray-100 dark:bg-gray-800' : ''}
        >
          <ArrowDown className="h-4 w-4 mr-2" />
          默认排序
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onSortChange('oldest')}
          className={sortBy === 'oldest' ? 'bg-gray-100 dark:bg-gray-800' : ''}
        >
          <ArrowUp className="h-4 w-4 mr-2" />
          按时间从旧到新
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
