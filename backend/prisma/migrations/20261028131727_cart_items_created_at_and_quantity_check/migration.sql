-- AlterTable
ALTER TABLE "cart_items" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Số lượng mỗi dòng trong giỏ từ 1 đến 99: lớp bảo vệ cuối cùng nếu code kiểm tra sót
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_quantity_range" CHECK ("quantity" BETWEEN 1 AND 99);
