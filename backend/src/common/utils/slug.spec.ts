import { slugify, SLUG_PATTERN } from './slug';

describe('slugify', () => {
  it.each([
    ['Điện thoại Samsung Galaxy S24', 'dien-thoai-samsung-galaxy-s24'],
    ['Áo thun   nam!!', 'ao-thun-nam'],
    ['  --Nồi cơm điện 1.8L--  ', 'noi-com-dien-1-8l'],
    ['ĐỒNG HỒ Thông Minh', 'dong-ho-thong-minh'],
  ])('%s => %s', (input, expected) => {
    expect(slugify(input)).toBe(expected);
    expect(slugify(input)).toMatch(SLUG_PATTERN);
  });

  it('không còn ký tự hợp lệ => chuỗi rỗng', () => {
    expect(slugify('!!! ???')).toBe('');
  });
});
