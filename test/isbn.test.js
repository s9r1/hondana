import { describe, it, expect } from 'vitest';
const { normalizeIsbn, isValidIsbn10, isValidIsbn13, isbn10to13, validateAndNormalizeIsbn } = require('../src/isbn.js');

describe('normalizeIsbn', () => {
  it('ハイフンを除去する', () => {
    expect(normalizeIsbn('978-4-641-16577-9')).toBe('9784641165779');
  });
  it('スペースを除去する', () => {
    expect(normalizeIsbn('978 4 641 16577 9')).toBe('9784641165779');
  });
});

describe('isValidIsbn13', () => {
  const valid = [
    '9784641165779',  // ゲーム理論 / 岡田章
    '9780195132601',  // The Mechanisms of Governance
  ];
  valid.forEach(isbn => {
    it(`${isbn} は有効`, () => {
      expect(isValidIsbn13(isbn)).toBe(true);
    });
  });

  it('チェックディジット不正は無効', () => {
    expect(isValidIsbn13('9784641165770')).toBe(false);
  });
  it('12桁は無効', () => {
    expect(isValidIsbn13('978464116577')).toBe(false);
  });
  it('非数字を含むと無効', () => {
    expect(isValidIsbn13('978013468599X')).toBe(false);
  });
});

describe('isValidIsbn10', () => {
  it('4769907427 は有効', () => {
    expect(isValidIsbn10('4769907427')).toBe(true);
  });
  it('末尾Xの有効なISBN-10', () => {
    expect(isValidIsbn10('155860832X')).toBe(true);
  });
  it('チェックディジット不正は無効', () => {
    expect(isValidIsbn10('4769907428')).toBe(false);
  });
});

describe('isbn10to13', () => {
  it('ISBN-10 → ISBN-13 変換', () => {
    expect(isbn10to13('4769907427')).toBe('9784769907428');
  });
});

describe('validateAndNormalizeIsbn', () => {
  it('有効なISBN-13をそのまま返す', () => {
    const result = validateAndNormalizeIsbn('9784641165779');
    expect(result.valid).toBe(true);
    expect(result.isbn13).toBe('9784641165779');
  });

  it('ハイフン付きISBN-13を正規化して返す', () => {
    const result = validateAndNormalizeIsbn('978-4-641-16577-9');
    expect(result.valid).toBe(true);
    expect(result.isbn13).toBe('9784641165779');
  });

  it('ISBN-10をISBN-13に変換して返す', () => {
    const result = validateAndNormalizeIsbn('4769907427');
    expect(result.valid).toBe(true);
    expect(result.isbn13).toBe('9784769907428');
  });

  it('不正なISBNはエラーを返す', () => {
    const result = validateAndNormalizeIsbn('123');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('10 or 13');
  });

  it('空文字はエラーを返す', () => {
    const result = validateAndNormalizeIsbn('');
    expect(result.valid).toBe(false);
  });
});
