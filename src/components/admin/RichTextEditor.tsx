'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Youtube from '@tiptap/extension-youtube';
import TiptapImage from '@tiptap/extension-image';
import { TextStyle, FontFamily } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import Placeholder from '@tiptap/extension-placeholder';
import { useId, useRef, useState, type ReactNode } from 'react';
import { AdminIcon } from './AdminIcons';
import { Spinner } from './SubmitButton';
import { uploadToBucket } from './ImageField';
import { EDITOR_FONT_CHOICES } from '@/lib/fonts';
import { useCustomFontChoices } from './custom-fonts-context';

/**
 * עורך טקסט עשיר מבוסס Tiptap.
 *
 * נבחר על פני CKEditor/Quill בגלל תמיכה טובה ב-RTL, פלט HTML נקי, והרחבה
 * רשמית להטמעת YouTube. הפלט נשמר לשדות body_he/body_en הקיימים — אין
 * שדה נפרד לווידאו.
 *
 * הרשימה כאן רחבה יותר ממה שהיה: sanitize.ts כבר אפשר מראש טבלאות,
 * תמונות, mark ו-sub/sup (ראו שם) — הכלים כאן רק משלימים את מה שהעורך
 * כבר תמך בו בפלט אך לא נתן דרך להזין. שני תוספות בלבד דורשות style
 * מוגבל: יישור טקסט וגופן, ושתיהן מוגבלות ל-allowedStyles מצומצם ב-
 * sanitize.ts כדי שלא ייפתח פתח להזרקת CSS חופשי.
 *
 * העורך שולח את התוכן דרך <input type="hidden">, כך שהטופס נשאר טופס HTML
 * רגיל שנשלח ל-Server Action.
 */

function ToolbarButton({
  active = false,
  onClick,
  title,
  disabled,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`admin-btn admin-btn-icon ${
        active ? 'bg-[var(--admin-accent)] text-white' : 'admin-btn-quiet'
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <span aria-hidden="true" className="mx-0.5 h-6 w-px self-center bg-rule" />;
}

export function RichTextEditor({
  name,
  label,
  defaultValue,
  hint,
  placeholder = 'התחל לכתוב…',
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  hint?: string;
  placeholder?: string;
}) {
  const id = useId();
  const customFonts = useCustomFontChoices();
  const [html, setHtml] = useState(defaultValue ?? '');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

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
      TiptapImage.configure({ HTMLAttributes: { loading: 'lazy' } }),
      TextStyle,
      FontFamily,
      // רק כותרות ופסקאות, לא רשימות/ציטוטים: יישור טקסט חופשי בתוך
      // רשימה נקרא מוזר ואינו מוסיף ערך. defaultAlignment נשאר null
      // (ברירת המחדל) בכוונה — כך שפסקה שלא נגעו בה לא מקבלת style כלל
      // (ראו renderHTML של ההרחבה) ונשארת ביישור הטבעי של כיוון הכתיבה.
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight,
      Subscript,
      Superscript,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder }),
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
        <span className="admin-field-label">{label}</span>
        <div className="min-h-56 rounded-[var(--admin-radius-card)] bg-cream-2" aria-busy="true" />
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

  async function addImage(file: File) {
    setUploadingImage(true);
    setImageError(null);
    try {
      const url = await uploadToBucket('covers', file);
      editor?.chain().focus().setImage({ src: url }).run();
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'ההעלאה נכשלה');
    } finally {
      setUploadingImage(false);
    }
  }

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  const currentFontFamily = (editor.getAttributes('textStyle').fontFamily as string | undefined) ?? '';

  return (
    <div>
      <span id={`${id}-label`} className="admin-field-label">
        {label}
      </span>

      <div className="admin-card overflow-hidden">
        <div
          role="toolbar"
          aria-label={`עיצוב — ${label}`}
          aria-controls={`${id}-editor`}
          className="flex flex-wrap items-center gap-1 border-b border-rule bg-cream-2/60 p-2"
        >
          <ToolbarButton title="מודגש (Ctrl+B)" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
            <span className="text-small font-bold">B</span>
          </ToolbarButton>
          <ToolbarButton title="נטוי (Ctrl+I)" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <span className="text-small italic">I</span>
          </ToolbarButton>
          <ToolbarButton title="קו תחתון (Ctrl+U)" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <span className="text-small underline">U</span>
          </ToolbarButton>
          <ToolbarButton title="קו חוצה" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
            <span className="text-small line-through">S</span>
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton title="כותרת ראשית בגוף התוכן" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            <span className="text-caption font-bold">H2</span>
          </ToolbarButton>
          <ToolbarButton title="כותרת משנה" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
            <span className="text-caption font-bold">H3</span>
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton title="רשימת תבליטים" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <AdminIcon name="list-bullet" className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title="רשימה ממוספרת" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <AdminIcon name="list-numbered" className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title="ציטוט" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
            <AdminIcon name="quote" className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton title="יישור לימין" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
            <AdminIcon name="align-right" className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title="מרכוז" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
            <AdminIcon name="align-center" className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title="יישור לשמאל" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
            <AdminIcon name="align-left" className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title="יישור לשני הצדדים" active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()}>
            <AdminIcon name="align-justify" className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton title="הדגשה בצבע" active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight().run()}>
            <AdminIcon name="highlighter" className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title="כתב תחתי" active={editor.isActive('subscript')} onClick={() => editor.chain().focus().toggleSubscript().run()}>
            <span className="text-small">
              X<sub>2</sub>
            </span>
          </ToolbarButton>
          <ToolbarButton title="כתב עילי" active={editor.isActive('superscript')} onClick={() => editor.chain().focus().toggleSuperscript().run()}>
            <span className="text-small">
              X<sup>2</sup>
            </span>
          </ToolbarButton>

          <ToolbarDivider />

          <label className="sr-only" htmlFor={`${id}-font`}>
            גופן
          </label>
          <select
            id={`${id}-font`}
            title="גופן"
            value={currentFontFamily}
            onChange={(event) => {
              const value = event.target.value;
              if (value) editor.chain().focus().setFontFamily(value).run();
              else editor.chain().focus().unsetFontFamily().run();
            }}
            className="admin-field-input h-9 w-36 py-1 text-caption"
          >
            <option value="">גופן ברירת מחדל</option>
            {EDITOR_FONT_CHOICES.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
            {/* [1.11] גופנים שהותקנו בהגדרות (custom_fonts) — ראו custom-fonts-context */}
            {customFonts.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>

          <ToolbarDivider />

          <ToolbarButton title="הוספת קישור" active={editor.isActive('link')} onClick={addLink}>
            <AdminIcon name="link" className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title="הטמעת סרטון YouTube" onClick={addVideo}>
            <AdminIcon name="video" className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title="הוספת תמונה" disabled={uploadingImage} onClick={() => imageInputRef.current?.click()}>
            {uploadingImage ? <Spinner className="h-4 w-4" /> : <AdminIcon name="image" className="h-4 w-4" />}
          </ToolbarButton>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void addImage(file);
            }}
          />
          <ToolbarButton title="הוספת טבלה" onClick={insertTable}>
            <AdminIcon name="table" className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton title="ביטול (Ctrl+Z)" onClick={() => editor.chain().focus().undo().run()}>
            <AdminIcon name="undo" className="h-4 w-4" />
          </ToolbarButton>
        </div>

        <div id={`${id}-editor`}>
          <EditorContent editor={editor} />
        </div>
      </div>

      <input type="hidden" name={name} value={html} />
      {imageError ? <span className="admin-field-error">{imageError}</span> : null}
      {hint ? <span className="admin-field-hint">{hint}</span> : null}
    </div>
  );
}
