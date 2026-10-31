import { IMAGE_URL_PATTERN } from './image-url';

describe('IMAGE_URL_PATTERN', () => {
  it.each([
    '/images/products/laptop/1.webp',
    '/images/products/ao-thun/6.webp',
    'https://cdn.example.com/a/b.jpg?w=800',
  ])('nhận %s', (url) => {
    expect(IMAGE_URL_PATTERN.test(url)).toBe(true);
  });

  it.each([
    'http://example.com/a.jpg',
    'javascript:alert(1)',
    'data:image/png;base64,AAAA',
    '/images/../etc/passwd',
    '/static/a.webp',
    'images/a.webp',
    'https://a.com/x y.jpg',
    'https://a.com/"onerror=x',
    '',
  ])('từ chối %s', (url) => {
    expect(IMAGE_URL_PATTERN.test(url)).toBe(false);
  });
});
