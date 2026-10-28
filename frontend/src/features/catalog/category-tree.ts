import type { CategoryNode } from './types'

const vietnameseCollator = new Intl.Collator('vi')

/**
 * Sắp theo bảng chữ cái tiếng Việt ở mọi cấp. Backend sắp theo collation của Postgres
 * nên "Điện tử" đứng sau "Thời trang".
 */
export function sortCategoryTree(tree: CategoryNode[]): CategoryNode[] {
  return [...tree]
    .sort((a, b) => vietnameseCollator.compare(a.name, b.name))
    .map((node) => ({ ...node, children: sortCategoryTree(node.children) }))
}

/** Đường đi từ gốc tới danh mục cần tìm (để làm breadcrumb); rỗng nếu không thấy. */
export function findCategoryPath(
  tree: CategoryNode[],
  match: (node: CategoryNode) => boolean,
): CategoryNode[] {
  for (const node of tree) {
    if (match(node)) return [node]
    const path = findCategoryPath(node.children, match)
    if (path.length) return [node, ...path]
  }
  return []
}
