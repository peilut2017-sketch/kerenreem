'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useState } from 'react';

/**
 * [1.11] עורך טקסט עשיר קל לטפסים ציבוריים (הערות והארות על ספר).
 *
 * גרסה מצומצמת במכוון של RichTextEditor הניהולי: הדגשה, נטוי, רשימות
 * וציטוט — כלי ניסוח, לא כלי עימוד. אין העלאת תמונות, אין טבלאות ואין
 * בחירת גופן; מה שמגיע מהציבור מנוקה שוב בשרת (sanitizeHtml) בכל מקרה.
 *
 * לא מבוקר: ה-HTML נשמר ב-state מקומי ונשלח דרך input חבוי, בדיוק כמו
 * העורך הניהולי — הטופס קורא אותו מ-FormData בשליחה.
 */
export function PublicRichTextField({
  name,
  label,
  labelId,
  placeholder,
  error,
  toolbarLabels,
}: {
  name: string;
  label: string;
  labelId: string;
  placeholder?: string;
  error?: string | null;
  toolbarLabels: { bold: string; italic: string; bulletList: string; orderedList: string; quote: string };
}) {
  const [html, setHtml] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        link: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
      }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
    ],
    content: '',
    immediatelyRender: false,
    onUpdate: ({ editor: current }) => {
      setHtml(current.isEmpty ? '' : current.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose-reem min-h-40 max-w-none px-4 py-3 focus:outline-none',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-labelledby': labelId,
      },
    },
  });

  const controls = editor
    ? ([
        {
          key: 'bold',
          label: toolbarLabels.bold,
          active: editor.isActive('bold'),
          run: () => editor.chain().focus().toggleBold().run(),
          glyph: <strong>ב</strong>,
        },
        {
          key: 'italic',
          label: toolbarLabels.italic,
          active: editor.isActive('italic'),
          run: () => editor.chain().focus().toggleItalic().run(),
          glyph: <em>נ</em>,
        },
        {
          key: 'bulletList',
          label: toolbarLabels.bulletList,
          active: editor.isActive('bulletList'),
          run: () => editor.chain().focus().toggleBulletList().run(),
          glyph: <span aria-hidden="true">•—</span>,
        },
        {
          key: 'orderedList',
          label: toolbarLabels.orderedList,
          active: editor.isActive('orderedList'),
          run: () => editor.chain().focus().toggleOrderedList().run(),
          glyph: <span aria-hidden="true">1—</span>,
        },
        {
          key: 'quote',
          label: toolbarLabels.quote,
          active: editor.isActive('blockquote'),
          run: () => editor.chain().focus().toggleBlockquote().run(),
          glyph: <span aria-hidden="true">”</span>,
        },
      ] as const)
    : [];

  return (
    <div>
      <span id={labelId} className="field-label">
        {label} <span aria-hidden="true">*</span>
      </span>
      <div
        className={`overflow-hidden rounded-[var(--radius-md)] border bg-white/70 ${
          error ? 'border-burgundy' : 'border-rule-strong'
        }`}
      >
        {editor ? (
          <div className="flex flex-wrap gap-1 border-b border-rule bg-cream-2/60 px-2 py-1.5" role="toolbar" aria-label={label}>
            {controls.map((control) => (
              <button
                key={control.key}
                type="button"
                onClick={control.run}
                aria-pressed={control.active}
                aria-label={control.label}
                title={control.label}
                className={`min-w-8 rounded-[var(--radius-sm)] px-2 py-1 text-small transition-colors ${
                  control.active ? 'bg-burgundy text-cream' : 'text-ink-soft hover:bg-cream-2'
                }`}
              >
                {control.glyph}
              </button>
            ))}
          </div>
        ) : (
          <div className="h-10 border-b border-rule bg-cream-2/60" aria-hidden="true" />
        )}
        <EditorContent editor={editor} dir="auto" />
      </div>
      <input type="hidden" name={name} value={html} />
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  );
}
