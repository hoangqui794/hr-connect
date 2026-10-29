import React, { useRef, useState } from 'react';
import { Button, Divider, Input, Tooltip } from 'antd';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import {
  BoldOutlined,
  ClearOutlined,
  EditOutlined,
  EyeOutlined,
  ItalicOutlined,
  MinusOutlined,
  OrderedListOutlined,
  UnderlineOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { formatMultilineText } from './jobDisplay';

export interface RichTextEditorProps {
  id?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  showCount?: boolean;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

/**
 * Safely parses inline formatting markers (**bold**, __underline__, *italic*)
 * into React nodes without using dangerouslySetInnerHTML.
 */
export const renderInlineFormatted = (line: string): React.ReactNode[] => {
  const tokenRegex = /(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*)/g;
  const parts = line.split(tokenRegex);

  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-slate-900">
          {renderInlineFormatted(part.slice(2, -2))}
        </strong>
      );
    }
    if (part.startsWith('__') && part.endsWith('__') && part.length > 4) {
      return (
        <u key={idx} className="underline underline-offset-2">
          {renderInlineFormatted(part.slice(2, -2))}
        </u>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={idx} className="italic">
          {renderInlineFormatted(part.slice(1, -1))}
        </em>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
};

/**
 * Renders multi-line job description / benefits with inline formatting (**bold**, *italic*, __underline__)
 * and preserved line breaks / bullets.
 */
export const renderFormattedMultilineText = (value: string | null | undefined): React.ReactNode => {
  const normalized = formatMultilineText(value);
  if (!normalized) return null;

  const lines = normalized.split('\n');
  return lines.map((line, idx) => (
    <React.Fragment key={idx}>
      {renderInlineFormatted(line)}
      {idx < lines.length - 1 && '\n'}
    </React.Fragment>
  ));
};

const toSentenceCaseLines = (text: string): string =>
  text
    .split('\n')
    .map((line) => {
      const match = line.match(/^(\s*(?:[•▪◦-]|\d+\.)?\s*)(.*)$/);
      if (!match) return line;
      const [, prefix, rest] = match;
      if (!rest) return line;
      const lower = rest.toLocaleLowerCase('vi-VN');
      return `${prefix}${lower.charAt(0).toLocaleUpperCase('vi-VN')}${lower.slice(1)}`;
    })
    .join('\n');

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  id,
  value = '',
  onChange,
  placeholder,
  rows = 6,
  maxLength,
  showCount = true,
  disabled = false,
  className = '',
  ...rest
}) => {
  const textAreaRef = useRef<TextAreaRef>(null);
  const [previewMode, setPreviewMode] = useState(false);

  const getNativeTextArea = (): HTMLTextAreaElement | null =>
    textAreaRef.current?.resizableTextArea?.textArea ?? null;

  const updateValueAndSelection = (
    nextValue: string,
    selectionStart: number,
    selectionEnd: number
  ) => {
    const finalValue = maxLength ? nextValue.slice(0, maxLength) : nextValue;
    onChange?.(finalValue);

    requestAnimationFrame(() => {
      const el = getNativeTextArea();
      if (!el) return;
      el.focus();
      el.setSelectionRange(
        Math.min(selectionStart, finalValue.length),
        Math.min(selectionEnd, finalValue.length)
      );
    });
  };

  /** Wrap or unwrap selected text with symmetric markers (e.g. **, *, __). */
  const applyWrap = (marker: string, defaultPlaceholder: string) => {
    if (disabled) return;
    const el = getNativeTextArea();
    const current = value ?? '';
    const start = el ? el.selectionStart : current.length;
    const end = el ? el.selectionEnd : current.length;
    const selected = current.slice(start, end);

    // If selection is already wrapped with marker inside or right around it, unwrap it
    if (
      selected.startsWith(marker) &&
      selected.endsWith(marker) &&
      selected.length >= marker.length * 2
    ) {
      const unwrapped = selected.slice(marker.length, selected.length - marker.length);
      const next = current.slice(0, start) + unwrapped + current.slice(end);
      updateValueAndSelection(next, start, start + unwrapped.length);
      return;
    }

    const beforeMarker = current.slice(Math.max(0, start - marker.length), start);
    const afterMarker = current.slice(end, end + marker.length);
    if (beforeMarker === marker && afterMarker === marker && selected.length > 0) {
      const next =
        current.slice(0, start - marker.length) +
        selected +
        current.slice(end + marker.length);
      updateValueAndSelection(
        next,
        start - marker.length,
        end - marker.length
      );
      return;
    }

    const inner = selected || defaultPlaceholder;
    const wrapped = `${marker}${inner}${marker}`;
    const next = current.slice(0, start) + wrapped + current.slice(end);
    updateValueAndSelection(
      next,
      start + marker.length,
      start + marker.length + inner.length
    );
  };

  /** Transform selected text or the current line (UPPERCASE / lowercase / Sentence case). */
  const applyCaseTransform = (mode: 'upper' | 'lower' | 'sentence') => {
    if (disabled) return;
    const el = getNativeTextArea();
    const current = value ?? '';
    if (!current) return;

    let start = el ? el.selectionStart : 0;
    let end = el ? el.selectionEnd : current.length;

    // If no text is selected, operate on the current line
    if (start === end) {
      const lineStart = current.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
      const nextNewline = current.indexOf('\n', start);
      const lineEnd = nextNewline === -1 ? current.length : nextNewline;
      start = lineStart;
      end = lineEnd;
    }

    const segment = current.slice(start, end);
    if (!segment) return;

    const transformed =
      mode === 'upper'
        ? segment.toLocaleUpperCase('vi-VN')
        : mode === 'lower'
          ? segment.toLocaleLowerCase('vi-VN')
          : toSentenceCaseLines(segment);

    const next = current.slice(0, start) + transformed + current.slice(end);
    updateValueAndSelection(next, start, start + transformed.length);
  };

  /** Toggle bullet or numbered list prefixes on selected lines. */
  const applyLineList = (type: 'bullet' | 'dash' | 'number') => {
    if (disabled) return;
    const el = getNativeTextArea();
    const current = value ?? '';
    const start = el ? el.selectionStart : current.length;
    const end = el ? el.selectionEnd : current.length;

    const lineStart = current.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const nextNewline = current.indexOf('\n', end);
    const lineEnd = nextNewline === -1 ? current.length : nextNewline;

    const block = current.slice(lineStart, lineEnd);
    const lines = block ? block.split('\n') : [''];

    const stripPrefix = (line: string) =>
      line.replace(/^\s*(?:[•▪◦-]|\d+\.)\s+/, '');

    const allHaveTargetPrefix = lines.every((line) => {
      if (!line.trim()) return true;
      if (type === 'bullet') return /^\s*•\s+/.test(line);
      if (type === 'dash') return /^\s*-\s+/.test(line);
      return /^\s*\d+\.\s+/.test(line);
    }) && lines.some((line) => line.trim().length > 0);

    let counter = 1;
    const updatedLines = lines.map((line) => {
      if (!line.trim() && lines.length > 1) return line;
      if (allHaveTargetPrefix) {
        return stripPrefix(line);
      }
      const clean = stripPrefix(line);
      if (type === 'bullet') return `• ${clean}`;
      if (type === 'dash') return `- ${clean}`;
      const numbered = `${counter}. ${clean}`;
      counter += 1;
      return numbered;
    });

    const replaced = updatedLines.join('\n');
    const next = current.slice(0, lineStart) + replaced + current.slice(lineEnd);
    updateValueAndSelection(next, lineStart, lineStart + replaced.length);
  };

  /** Strip formatting markers (**bold**, *italic*, __underline__, bullets) from selection or all text. */
  const handleClearFormatting = () => {
    if (disabled) return;
    const el = getNativeTextArea();
    const current = value ?? '';
    if (!current) return;

    const hasSelection = el && el.selectionStart !== el.selectionEnd;
    const start = hasSelection ? el.selectionStart : 0;
    const end = hasSelection ? el.selectionEnd : current.length;
    const segment = current.slice(start, end);

    const cleaned = segment
      .replace(/\*\*([^*\n]+)\*\*/g, '$1')
      .replace(/__([^_\n]+)__/g, '$1')
      .replace(/\*([^*\n]+)\*/g, '$1')
      .replace(/^\s*(?:[•▪◦-]|\d+\.)\s+/gm, '');

    const next = current.slice(0, start) + cleaned + current.slice(end);
    updateValueAndSelection(next, start, start + cleaned.length);
  };

  /** Keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+U) and smart Enter continuation for lists. */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (disabled) return;

    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();
      if (key === 'b') {
        e.preventDefault();
        applyWrap('**', 'in đậm');
        return;
      }
      if (key === 'i') {
        e.preventDefault();
        applyWrap('*', 'in nghiêng');
        return;
      }
      if (key === 'u') {
        e.preventDefault();
        applyWrap('__', 'gạch chân');
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
      const el = e.currentTarget;
      const current = value ?? '';
      const pos = el.selectionStart;
      if (pos !== el.selectionEnd) return;

      const lineStart = current.lastIndexOf('\n', Math.max(0, pos - 1)) + 1;
      const currentLineBeforeCursor = current.slice(lineStart, pos);

      const bulletMatch = currentLineBeforeCursor.match(/^(\s*([•-])\s+)(.*)$/);
      if (bulletMatch) {
        const [, fullPrefix, marker, content] = bulletMatch;
        const restOfLine = current.slice(pos, current.indexOf('\n', pos) === -1 ? current.length : current.indexOf('\n', pos));
        e.preventDefault();

        // Empty bullet line -> remove bullet prefix
        if (!content.trim() && !restOfLine.trim()) {
          const next = current.slice(0, lineStart) + current.slice(pos);
          updateValueAndSelection(next, lineStart, lineStart);
          return;
        }

        const insertion = `\n${marker} `;
        const next = current.slice(0, pos) + insertion + current.slice(pos);
        const nextCursor = pos + insertion.length;
        void fullPrefix;
        updateValueAndSelection(next, nextCursor, nextCursor);
        return;
      }

      const numMatch = currentLineBeforeCursor.match(/^(\s*(\d+)\.\s+)(.*)$/);
      if (numMatch) {
        const [, , numStr, content] = numMatch;
        const restOfLine = current.slice(pos, current.indexOf('\n', pos) === -1 ? current.length : current.indexOf('\n', pos));
        e.preventDefault();

        if (!content.trim() && !restOfLine.trim()) {
          const next = current.slice(0, lineStart) + current.slice(pos);
          updateValueAndSelection(next, lineStart, lineStart);
          return;
        }

        const nextNum = Number(numStr) + 1;
        const insertion = `\n${nextNum}. `;
        const next = current.slice(0, pos) + insertion + current.slice(pos);
        const nextCursor = pos + insertion.length;
        updateValueAndSelection(next, nextCursor, nextCursor);
      }
    }
  };

  return (
    <div
      className={`rich-text-editor rounded-xl border border-solid border-slate-200 bg-white transition-colors focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/15 ${className}`}
    >
      {/* Formatting Toolbar */}
      <div
        role="toolbar"
        aria-label="Thanh công cụ định dạng văn bản"
        className="flex flex-wrap items-center justify-between gap-1 border-0 border-b border-solid border-slate-200 bg-slate-50/90 px-2.5 py-1.5 rounded-t-xl"
      >
        <div className="flex flex-wrap items-center gap-0.5">
          <Tooltip title="In đậm (Ctrl+B)">
            <Button
              type="text"
              size="small"
              icon={<BoldOutlined />}
              disabled={disabled || previewMode}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyWrap('**', 'văn bản in đậm')}
              aria-label="In đậm"
              className="!h-7 !w-7 !p-0 text-slate-700 hover:!bg-slate-200/70"
            />
          </Tooltip>

          <Tooltip title="In nghiêng (Ctrl+I)">
            <Button
              type="text"
              size="small"
              icon={<ItalicOutlined />}
              disabled={disabled || previewMode}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyWrap('*', 'văn bản in nghiêng')}
              aria-label="In nghiêng"
              className="!h-7 !w-7 !p-0 text-slate-700 hover:!bg-slate-200/70"
            />
          </Tooltip>

          <Tooltip title="Gạch chân (Ctrl+U)">
            <Button
              type="text"
              size="small"
              icon={<UnderlineOutlined />}
              disabled={disabled || previewMode}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyWrap('__', 'văn bản gạch chân')}
              aria-label="Gạch chân"
              className="!h-7 !w-7 !p-0 text-slate-700 hover:!bg-slate-200/70"
            />
          </Tooltip>

          <Divider type="vertical" className="mx-1 h-4 bg-slate-200" />

          <Tooltip title="Chuyển thành chữ IN HOA">
            <Button
              type="text"
              size="small"
              disabled={disabled || previewMode}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyCaseTransform('upper')}
              aria-label="In hoa"
              className="!h-7 !px-1.5 text-xs font-bold text-slate-700 hover:!bg-slate-200/70"
            >
              AA
            </Button>
          </Tooltip>

          <Tooltip title="Chuyển thành chữ thường">
            <Button
              type="text"
              size="small"
              disabled={disabled || previewMode}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyCaseTransform('lower')}
              aria-label="Chữ thường"
              className="!h-7 !px-1.5 text-xs font-medium text-slate-700 hover:!bg-slate-200/70"
            >
              aa
            </Button>
          </Tooltip>

          <Tooltip title="Viết hoa chữ cái đầu dòng">
            <Button
              type="text"
              size="small"
              disabled={disabled || previewMode}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyCaseTransform('sentence')}
              aria-label="Viết hoa đầu câu"
              className="!h-7 !px-1.5 text-xs font-semibold text-slate-700 hover:!bg-slate-200/70"
            >
              Aa
            </Button>
          </Tooltip>

          <Divider type="vertical" className="mx-1 h-4 bg-slate-200" />

          <Tooltip title="Gạch đầu dòng (•)">
            <Button
              type="text"
              size="small"
              icon={<UnorderedListOutlined />}
              disabled={disabled || previewMode}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyLineList('bullet')}
              aria-label="Gạch đầu dòng"
              className="!h-7 !w-7 !p-0 text-slate-700 hover:!bg-slate-200/70"
            />
          </Tooltip>

          <Tooltip title="Gạch ngang đầu dòng (-)">
            <Button
              type="text"
              size="small"
              icon={<MinusOutlined />}
              disabled={disabled || previewMode}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyLineList('dash')}
              aria-label="Gạch ngang đầu dòng"
              className="!h-7 !w-7 !p-0 text-slate-700 hover:!bg-slate-200/70"
            />
          </Tooltip>

          <Tooltip title="Danh sách đánh số (1. 2. 3.)">
            <Button
              type="text"
              size="small"
              icon={<OrderedListOutlined />}
              disabled={disabled || previewMode}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyLineList('number')}
              aria-label="Danh sách đánh số"
              className="!h-7 !w-7 !p-0 text-slate-700 hover:!bg-slate-200/70"
            />
          </Tooltip>

          <Divider type="vertical" className="mx-1 h-4 bg-slate-200" />

          <Tooltip title="Xóa định dạng vùng chọn">
            <Button
              type="text"
              size="small"
              icon={<ClearOutlined />}
              disabled={disabled || previewMode}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleClearFormatting}
              aria-label="Xóa định dạng"
              className="!h-7 !w-7 !p-0 text-slate-500 hover:!bg-slate-200/70 hover:!text-slate-800"
            />
          </Tooltip>
        </div>

        <Button
          type="text"
          size="small"
          icon={previewMode ? <EditOutlined /> : <EyeOutlined />}
          onClick={() => setPreviewMode((prev) => !prev)}
          className="!h-7 !px-2 text-xs font-medium text-slate-600 hover:!bg-slate-200/70"
        >
          {previewMode ? 'Soạn thảo' : 'Xem trước'}
        </Button>
      </div>

      {/* Editor or Preview Surface */}
      {previewMode ? (
        <div
          className="min-h-[132px] whitespace-pre-line break-words px-3.5 py-2.5 text-sm leading-relaxed text-slate-800"
          style={{ minHeight: rows * 24 }}
        >
          {value?.trim() ? (
            renderFormattedMultilineText(value)
          ) : (
            <span className="text-slate-400 italic">Chưa có nội dung để xem trước.</span>
          )}
        </div>
      ) : (
        <Input.TextArea
          ref={textAreaRef}
          id={id}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={rows}
          maxLength={maxLength}
          showCount={showCount}
          disabled={disabled}
          placeholder={placeholder}
          variant="borderless"
          className="!px-3.5 !py-2.5 text-sm leading-relaxed"
          {...rest}
        />
      )}
    </div>
  );
};

export default RichTextEditor;

