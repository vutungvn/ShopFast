import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/cn'
import { findCategoryPath } from '../category-tree'
import type { CategoryNode } from '../types'

type CategoryFilterProps = {
  tree: CategoryNode[]
  selected?: string
  onSelect: (slug: string | undefined) => void
}

const itemClass =
  'w-full rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'

export function CategoryFilter({ tree, selected, onSelect }: CategoryFilterProps) {
  // Mở sẵn nhánh chứa danh mục đang chọn
  const selectedRoot = findCategoryPath(tree, (n) => n.slug === selected)[0]?.id
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(selectedRoot ? [selectedRoot] : []),
  )

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const optionClass = (active: boolean) =>
    cn(itemClass, active ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')

  return (
    <ul className="space-y-0.5">
      <li>
        <button type="button" onClick={() => onSelect(undefined)} className={optionClass(!selected)}>
          Tất cả sản phẩm
        </button>
      </li>
      {tree.map((root) => {
        const isOpen = expanded.has(root.id) || root.id === selectedRoot
        return (
          <li key={root.id}>
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => onSelect(root.slug)}
                aria-current={selected === root.slug ? 'true' : undefined}
                className={optionClass(selected === root.slug)}
              >
                {root.name}
              </button>
              {root.children.length > 0 && (
                <button
                  type="button"
                  onClick={() => toggle(root.id)}
                  aria-expanded={isOpen}
                  aria-label={`${isOpen ? 'Thu gọn' : 'Mở rộng'} ${root.name}`}
                  className="ml-1 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <ChevronDown className={cn('size-4 transition-transform', isOpen && 'rotate-180')} />
                </button>
              )}
            </div>
            {isOpen && root.children.length > 0 && (
              <ul className="mt-0.5 ml-3 space-y-0.5 border-l border-slate-200 pl-2">
                {root.children.map((child) => (
                  <li key={child.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(child.slug)}
                      aria-current={selected === child.slug ? 'true' : undefined}
                      className={optionClass(selected === child.slug)}
                    >
                      {child.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}
