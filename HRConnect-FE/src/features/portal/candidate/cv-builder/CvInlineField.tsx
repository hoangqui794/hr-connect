import React, { useRef, useEffect } from 'react';

export interface CvInlineFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  className?: string;
  style?: React.CSSProperties;
  'aria-label'?: string;
  readOnly?: boolean;
  maxLength?: number;
  autoFocus?: boolean;
  onBlur?: () => void;
}

/**
 * Ghost Input / Textarea for inline WYSIWYG editing directly on the A4 canvas.
 * - Displays naturally as clean text.
 * - Displays subtle dashed border on hover.
 * - Displays gentle focus outline when clicked/focused.
 * - Fully isolates keyboard (Space, Enter, Arrows) and pointer events from outer drag/button handlers.
 */
export const CvInlineField: React.FC<CvInlineFieldProps> = ({
  value,
  onChange,
  placeholder = 'Nhấp để chỉnh sửa...',
  multiline = false,
  rows = 2,
  className = '',
  style,
  'aria-label': ariaLabel,
  readOnly = false,
  maxLength,
  autoFocus = false,
  onBlur,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height as content expands
  useEffect(() => {
    if (multiline && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value, multiline]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // Crucial: stop propagation for Space, Enter, and Arrow keys so outer drag handlers,
    // buttons, or document listeners never capture or prevent them
    if (e.key === ' ' || e.code === 'Space' || e.key === 'Enter' || e.key.startsWith('Arrow')) {
      e.stopPropagation();
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // Prevent drag libraries or parent drag handlers from initiating drag when clicking inside inputs
    e.stopPropagation();
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.stopPropagation();
  };

  const baseClasses =
    'w-full transition-all duration-150 rounded px-1.5 py-0.5 border border-transparent outline-none bg-transparent ' +
    'hover:border-dashed hover:border-slate-300 hover:bg-slate-50/70 ' +
    'focus:border-solid focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100/80 ' +
    'placeholder:italic placeholder:text-slate-400 placeholder:font-normal';

  if (multiline) {
    return (
      <textarea
        ref={textareaRef}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onMouseDown={handleMouseDown}
        onBlur={onBlur}
        placeholder={placeholder}
        aria-label={ariaLabel || placeholder}
        readOnly={readOnly}
        maxLength={maxLength}
        autoFocus={autoFocus}
        style={{ fontFamily: 'inherit', ...style }}
        className={`${baseClasses} resize-none overflow-hidden ${className}`}
      />
    );
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onMouseDown={handleMouseDown}
      onBlur={onBlur}
      placeholder={placeholder}
      aria-label={ariaLabel || placeholder}
      readOnly={readOnly}
      maxLength={maxLength}
      autoFocus={autoFocus}
      style={{ fontFamily: 'inherit', ...style }}
      className={`${baseClasses} ${className}`}
    />
  );
};

export default CvInlineField;
