import { Category } from '@prisma/client';
import { CategoryNodeDto } from './dto/category-response.dto';

/** Dựng cây từ danh sách phẳng; danh mục có cha không tồn tại được coi là gốc. */
export function buildCategoryTree(categories: Category[]): CategoryNodeDto[] {
  const nodes = new Map<string, CategoryNodeDto>(
    categories.map((c) => [
      c.id,
      {
        id: c.id,
        name: c.name,
        slug: c.slug,
        parentId: c.parentId,
        children: [],
      },
    ]),
  );
  const roots: CategoryNodeDto[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** id của danh mục gốc cùng mọi danh mục con cháu (để lọc sản phẩm theo danh mục cha). */
export function collectDescendantIds(
  categories: Category[],
  rootId: string,
): string[] {
  const childrenOf = new Map<string, string[]>();
  for (const c of categories) {
    if (!c.parentId) continue;
    const siblings = childrenOf.get(c.parentId) ?? [];
    siblings.push(c.id);
    childrenOf.set(c.parentId, siblings);
  }

  const result: string[] = [];
  const visited = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    result.push(id);
    stack.push(...(childrenOf.get(id) ?? []));
  }
  return result;
}
