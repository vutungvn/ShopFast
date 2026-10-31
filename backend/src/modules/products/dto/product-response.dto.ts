import { BrandDto } from '../../brands/dto/brand-response.dto';
import { CategoryDto } from '../../categories/dto/category-response.dto';
import { ProductWithRelations } from '../products.repository';

export class ProductResponseDto {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description: string | null;
  /** Ảnh chính; null => giao diện hiện icon theo danh mục */
  imageUrl: string | null;
  /** Giá bán (VND) */
  price: number;
  isActive: boolean;
  /** Tồn kho hiện tại */
  stock: number;
  category: CategoryDto;
  brand: BrandDto;
  createdAt: Date;
  updatedAt: Date;

  static from(product: ProductWithRelations): ProductResponseDto {
    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      slug: product.slug,
      description: product.description,
      imageUrl: product.imageUrl,
      // DECIMAL(12,2) nằm trong khoảng số nguyên an toàn của JS nên đổi sang number không mất chính xác
      price: product.price.toNumber(),
      isActive: product.isActive,
      stock: product.inventory?.stock ?? 0,
      category: product.category,
      brand: product.brand,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}
