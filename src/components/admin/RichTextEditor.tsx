'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Youtube from '@tiptap/extension-youtube';
import { useId, useState } from 'react';

/**
 * עורך טקסט עשיר מבוסס Tiptap.
 *
 * נבחר על פני CKEditor/Quill בגלל תמיכה טובה ב-RTL, פלט HTML נקי, והרחבה
 * רשמית להטמעת YouTube. הפלט נשמר לשדות body_he/body_en הקיימים — אין
 * שדה נפרד לווידאו.
 *
 * העורך שולח את התוכן דרך <input type="hidden">, כך שהטופס נשאר טופס HTML
 * רגיל שנשלח ל-Server Action.
 */

const BUTTON =
  'px-2.5 py-1.5 text-caption border border-rule-strong bg-paper hover:bg-paper-2 transition-colors';
const BUTTON_ACTIVE = 'px-2.5 py-1.5 text-caption border border-burgundy bg-burgundy text-paper';

function ToolbarButton({
  active,
  onClick,
  label,
  title,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={active ? BUTTON_ACTIVE : BUTTON}
    >
      {label}
    </button>
  );
}

export function RichTextEditor({
  name,
  label,
  defaultValue,
  hint,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  hint?: string;
}) {
  const id = useId();
  const [html, setHtml] = useState(defaultValue ?? '');

  const editor = useEditor({
    // חובה ב-App Router: רינדור מיידי בשרת שובר את ה-hydration.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        protocols: ['http', 'https', 'mailto', 'tel'],
      }),
      Youtube.configure({
        nocookie: true,
        controls: true,
        width: 640,
        height: 360,
      }),
    ],
    content: defaultValue ?? '',
    onUpdate: ({ editor: instance }) => setHtml(instance.getHTML()),
    editorProps: {
      attributes: {
        class: 'prose-reem min-h-56 max-w-none px-4 py-3 focus:outline-none',
        dir: 'rtl',
        'aria-labelledby': `${id}-label`,
        role: 'textbox',
        'aria-multiline': 'true',
      },
    },
  });

  if (!editor) {
    return (
      <div>
        <span className="field-label">{label}</span>
        <div className="min-h-56 border border-rule-strong bg-paper-2" aria-busy="true" />
      </div>
    );
  }

  const addLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('כתובת הקישור', previous ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const addVideo = () => {
    const url = window.prompt('כתובת סרטון YouTube');
    if (!url) return;
    editor.commands.setYoutubeVideo({ src: url, width: 640, height: 360 });
  };

  return (
    <div>
      <span id={`${id}-label`} className="field-label">
        {label}
      </span>

      <div className="border border-rule-strong bg-white">
        <div
          role="toolbar"
          aria-label={`עיצוב — ${label}`}
          aria-controls={`${id}-editor`}
          className="flex flex-wrap gap-1 border-b border-rule bg-paper-2 p-2"
        >
          <ToolbarButton
            label="מודגש"
            title="מודגש (Ctrl+B)"
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
          <ToolbarButton
            label="נטוי"
            title="נטוי (Ctrl+I)"
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          />
          <span aria-hidden="true" className="mx-1 w-px bg-rule" />
          <ToolbarButton
            label="כותרת"
            title="כותרת ראשית בגוף התוכן"
            active={editor.isActive('heading', { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          />
          <ToolbarButton
            label="כותרת משנה"
            title="כותרת משנה"
            active={editor.isActive('heading', { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          />
          <span aria-hidden="true" className="mx-1 w-px bg-rule" />
          <ToolbarButton
            label="רשימה"
            title="רשימת תבליטים"
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          />
          <ToolbarButton
            label="רשימה ממוספרת"
            title="רשימה ממוספרת"
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          />
          <ToolbarButton
            label="ציטוט"
            title="ציטוט"
            active={editor.isActive('blockquote')}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          />
          <span aria-hidden="true" className="mx-1 w-px bg-rule" />
          <ToolbarButton
            label="קישור"
            title="הוספת קישור"
            active={editor.isActive('link')}
            onClick={addLink}
          />
          <ToolbarButton
            label="סרטון"
            title="הטמעת סרטון YouTube"
            active={false}
            onClick={addVideo}
          />
          <span aria-hidden="true" className="mx-1 w-px bg-rule" />
          <ToolbarButton
            label="ביטול"
            title="ביטול (Ctrl+Z)"
            active={false}
            onClick={() => editor.chain().focus().undo().run()}
          />
        </div>

        <div id={`${id}-editor`}>
          <EditorContent editor={editor} />
        </div>
      </div>

      <input type="hidden" name={name} value={html} />
      {hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}
