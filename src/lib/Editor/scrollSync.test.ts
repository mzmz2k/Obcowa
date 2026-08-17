// scrollSync関数の単体テスト
import { describe, it, expect } from 'vitest';
import { calculateScrollRatio, calculateScrollTopFromRatio } from './scrollSync';

describe('scrollSync', () => {
    it('スクロール比率を正しく計算できる', () => {
        expect(calculateScrollRatio(100, 200)).toBe(0.5);
        expect(calculateScrollRatio(0, 200)).toBe(0);
        expect(calculateScrollRatio(200, 200)).toBe(1);
    });

    it('高さが0以下の場合は0を返す', () => {
        expect(calculateScrollRatio(100, 0)).toBe(0);
    });

    it('比率からscrollTopを正しく計算できる', () => {
        expect(calculateScrollTopFromRatio(0.5, 200)).toBe(100);
        expect(calculateScrollTopFromRatio(1.0, 200)).toBe(200);
    });
});