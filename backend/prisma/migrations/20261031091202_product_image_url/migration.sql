-- AlterTable
ALTER TABLE "products" ADD COLUMN     "imageUrl" TEXT;

-- Lớp bảo vệ cuối cùng nếu code kiểm tra sót (khớp MAX_IMAGE_URL)
ALTER TABLE "products" ADD CONSTRAINT "products_image_url_length" CHECK (char_length("imageUrl") <= 500);
