import { describe, it, expect } from 'vitest';
import { generateStyleCssVariables, defaultStyle, type StyleSlot } from './styleStore';

describe('Style Settings Logic', () => {
    it('generateStyleCssVariables が正しいCSS変数を生成する', () => {
        const mockStyle: StyleSlot = {
            ...defaultStyle,
            editorFont: 'monospace',
            editorFontSize: 18,
            lineHeight: 2.0,
            h1: { fontSize: 3.0, borderBottom: true, italic: true, bold: false }
        };

        const result = generateStyleCssVariables(mockStyle);

        // エディタ全体設定の検証
        expect(result['--editor-font']).toBe('monospace');
        expect(result['--editor-font-size']).toBe('18px');
        expect(result['--editor-line-height']).toBe('2');

        // H1設定の検証
        expect(result['--h1-size']).toBe('3rem');
        expect(result['--h1-border']).toContain('1px solid');
        expect(result['--h1-style']).toBe('italic');
        expect(result['--h1-weight']).toBe('normal');

        // H2設定（デフォルト値）の検証
        expect(result['--h2-style']).toBe('normal');
        expect(result['--h2-weight']).toBe('bold');
    });
});