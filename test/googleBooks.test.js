/**
 * Google Books APIレスポンスのパーステスト
 *
 * 実際のAPIレスポンスに基づくフィクスチャで、パーサーの正確性を検証。
 * APIの仕様変更やエッジケース発見時にフィクスチャを追加していく。
 */
import { describe, it, expect } from 'vitest';
const { parseGoogleBooksResponse } = require('../src/googleBooks.js');

// ============================================================
// フィクスチャ: 実際のGoogle Books APIレスポンスを模したデータ
// ============================================================

const FIXTURES = {
  // 洋書: The Mechanisms of Governance（情報充実パターン）
  '9780195132601': {
    input: {
      totalItems: 1,
      items: [{
        volumeInfo: {
          title: 'The Mechanisms of Governance',
          authors: ['Oliver E. Williamson'],
          publisher: 'Oxford University Press',
          publishedDate: '1999-01-28',
          language: 'en',
          categories: ['Business & Economics'],
          imageLinks: { thumbnail: 'http://books.google.com/books/content?id=xxx' },
          description: 'Some description',
          pageCount: 429
        }
      }]
    },
    expected: {
      title: 'The Mechanisms of Governance',
      authors: ['Oliver E. Williamson'],
      publisher: 'Oxford University Press',
      publishedDate: '1999-01-28',
      language: 'en',
      categories: ['Business & Economics'],
      source: 'googleBooks'
    }
  },

  // 和書: ゲーム理論 / 岡田章
  '9784641165779': {
    input: {
      totalItems: 1,
      items: [{
        volumeInfo: {
          title: 'ゲーム理論',
          authors: ['岡田章'],
          publisher: '有斐閣',
          publishedDate: '2021-03',
          language: 'ja',
          categories: ['Mathematics']
        }
      }]
    },
    expected: {
      title: 'ゲーム理論',
      authors: ['岡田章'],
      publisher: '有斐閣',
      publishedDate: '2021-03',
      language: 'ja',
      source: 'googleBooks'
    }
  },

  // フィールド欠損パターン（authors, publisher が欠損）
  '9787500559795': {
    input: {
      totalItems: 1,
      items: [{
        volumeInfo: {
          title: '公共经济学',
          publishedDate: '2002',
          language: 'zh-CN'
        }
      }]
    },
    expected: {
      title: '公共经济学',
      authors: [],
      publisher: '',
      language: 'zh-CN'
    }
  },
};

// ============================================================
// テスト
// ============================================================

describe('parseGoogleBooksResponse - fixture tests', () => {
  Object.entries(FIXTURES).forEach(([isbn, fixture]) => {
    it(`${isbn}: ${fixture.expected.title}`, () => {
      const result = parseGoogleBooksResponse(isbn, fixture.input);
      expect(result).not.toBeNull();
      expect(result.isbn).toBe(isbn);

      // 期待フィールドとの照合
      for (const [key, val] of Object.entries(fixture.expected)) {
        if (Array.isArray(val)) {
          expect(result[key]).toEqual(val);
        } else {
          expect(result[key]).toBe(val);
        }
      }
    });
  });

  it('totalItems: 0 の場合 null を返す', () => {
    expect(parseGoogleBooksResponse('0000', { totalItems: 0 })).toBeNull();
  });

  it('null レスポンスで null を返す', () => {
    expect(parseGoogleBooksResponse('0000', null)).toBeNull();
  });
});
