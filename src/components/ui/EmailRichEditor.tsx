import { useEffect, useRef } from 'react';

interface EmailRichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

function exec(command: string, value?: string) {
  document.execCommand(command, false, value);
}

/**
 * Lightweight email composer toolbar: bold/italic/underline, sizes, lists, links.
 * Stores HTML suitable for CRM bulk email (no external editor peer-deps).
 */
export default function EmailRichEditor({
  value,
  onChange,
  placeholder = '',
  className = '',
}: EmailRichEditorProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.innerHTML !== value) {
      el.innerHTML = value || '';
    }
  }, [value]);

  const emit = () => {
    const html = ref.current?.innerHTML ?? '';
    onChange(html);
  };

  const insertLink = () => {
    const url = window.prompt('URL (https://...)', 'https://');
    if (!url) return;
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    ref.current?.focus();
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      exec('createLink', href);
    } else {
      exec('insertHTML', `<a href="${href}">${href}</a>`);
    }
    emit();
  };

  const btn =
    'rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50';

  return (
    <div className={`overflow-hidden rounded-lg border border-gray-300 ${className}`}>
      <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 p-2">
        <button type="button" className={`${btn} font-bold`} title="Bold" onMouseDown={(e) => { e.preventDefault(); exec('bold'); emit(); }}>B</button>
        <button type="button" className={`${btn} italic`} title="Italic" onMouseDown={(e) => { e.preventDefault(); exec('italic'); emit(); }}>I</button>
        <button type="button" className={`${btn} underline`} title="Underline" onMouseDown={(e) => { e.preventDefault(); exec('underline'); emit(); }}>U</button>
        <span className="mx-1 h-4 w-px bg-gray-300" />
        <button type="button" className={btn} title="Small" onMouseDown={(e) => { e.preventDefault(); exec('fontSize', '2'); emit(); }}>A-</button>
        <button type="button" className={btn} title="Normal" onMouseDown={(e) => { e.preventDefault(); exec('fontSize', '3'); emit(); }}>A</button>
        <button type="button" className={`${btn} text-sm`} title="Large" onMouseDown={(e) => { e.preventDefault(); exec('fontSize', '5'); emit(); }}>A+</button>
        <span className="mx-1 h-4 w-px bg-gray-300" />
        <button type="button" className={btn} title="Bullet list" onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList'); emit(); }}>• List</button>
        <button type="button" className={btn} title="Numbered list" onMouseDown={(e) => { e.preventDefault(); exec('insertOrderedList'); emit(); }}>1. List</button>
        <span className="mx-1 h-4 w-px bg-gray-300" />
        <button type="button" className={btn} title="Insert link" onMouseDown={(e) => { e.preventDefault(); insertLink(); }}>Link</button>
        <button type="button" className={btn} title="Remove link" onMouseDown={(e) => { e.preventDefault(); exec('unlink'); emit(); }}>Unlink</button>
        <button type="button" className={btn} title="Clear formatting" onMouseDown={(e) => { e.preventDefault(); exec('removeFormat'); emit(); }}>Clear</button>
      </div>
      <div
        ref={ref}
        contentEditable
        role="textbox"
        aria-multiline="true"
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        data-placeholder={placeholder}
        className="min-h-[180px] px-3 py-2 text-sm text-gray-900 outline-none empty:before:pointer-events-none empty:before:text-gray-400 empty:before:content-[attr(data-placeholder)] [&_a]:text-blue-600 [&_a]:underline"
      />
    </div>
  );
}

/** True when editor HTML has visible text (ignores empty tags). */
export function richTextHasContent(html: string): boolean {
  const text = html
    .replace(/<br\s*\/?>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .trim();
  return text.length > 0;
}
