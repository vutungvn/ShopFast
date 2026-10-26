export class CategoryDto {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
}

export class CategoryNodeDto extends CategoryDto {
  children: CategoryNodeDto[];
}
