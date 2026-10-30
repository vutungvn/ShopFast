/*
  Warnings:

  - Added the required column `recipientName` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `recipientPhone` to the `orders` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "recipientName" TEXT NOT NULL,
ADD COLUMN     "recipientPhone" TEXT NOT NULL,
ADD COLUMN     "shippingFee" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Lớp bảo vệ cuối cùng nếu code tính tiền hoặc kiểm tra số lượng sót
ALTER TABLE "orders" ADD CONSTRAINT "orders_amounts_non_negative" CHECK ("totalAmount" >= 0 AND "shippingFee" >= 0);
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_unit_price_non_negative" CHECK ("unitPrice" >= 0);
