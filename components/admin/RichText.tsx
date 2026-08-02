'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { useEffect, useRef, useState } from 'react';

/**
 * Editor for one HTML field, with an HTML source mode and a visual mode.
 *
 * WHY HTML IS THE DEFAULT
 * A WYSIWYG can only keep markup its schema understands. This site's content is
 * imported theme markup — nested divs, sections, custom classes, inline styles,
 * icon tags — and tiptap silently discards every node it has no rule for. On a
 * real blog page that meant 87,604 characters in and 15,718 characters out: an
 * 82% loss, written straight back to the database on save with no warning.
 *
 * So the source view is the default and is exactly lossless. The visual editor is
 * still available, because it is genuinely nicer for plain prose, but it is opt-in
 * per field and says plainly what it will do before it does it.
 *
 * `html` is the single source of truth. The visual editor only writes to it after
 * the user actually types — mounting alone must never rewrite the field, or
 * merely opening the tab would destroy content.
 */
export default function RichText({
  name,
  initialHtml,
  minHeight = 300,
}: {
  name: string;
  initialHtml: string;
  minHeight?: number;
}) {
  const original = initialHtml ?? '';
  const [html, setHtml] = useState(original);
  const [mode, setMode] = useState<'html' | 'visual'>('html');
  const [mounted, setMounted] = useState(false);
  /** Set on the first real keystroke in the visual editor. */
  const touched = useRef(false);

  useEffect(() => setMounted(true), []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      Image,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: html,
    onUpdate: ({ editor }) => {
      // Ignore the update tiptap emits while loading content — only a genuine
      // edit may replace the stored HTML with tiptap's normalised version.
      if (!touched.current) return;
      setHtml(editor.getHTML());
    },
  });

  /** How much this field would lose if the visual editor took it over. */
  const normalisedLength = mounted && editor ? editor.getHTML().length : 0;
  const lossPct =
    html.length > 0 && normalisedLength > 0
      ? Math.max(0, Math.round((1 - normalisedLength / html.length) * 100))
      : 0;
  const lossy = lossPct >= 10;

  const tab = (id: 'html' | 'visual', label: string) => (
    <button
      type="button"
      className={mode === id ? 'is-active' : undefined}
      onClick={() => {
        if (id === 'visual' && editor) {
          // Reload the editor from the truth each time the tab opens, so it
          // never shows a stale document.
          editor.commands.setContent(html, { emitUpdate: false });
          touched.current = false;
        }
        setMode(id);
      }}
    >
      {label}
    </button>
  );

  return (
    <>
      <div className="a-editor">
        <div className="a-editor-toolbar">
          {tab('html', 'HTML')}
          {tab('visual', 'Visual')}
          <span className="sep" />

          {mode === 'visual' && editor ? (
            <>
              <button type="button" onClick={() => { touched.current = true; editor.chain().focus().toggleBold().run(); }} className={editor.isActive('bold') ? 'is-active' : undefined}>B</button>
              <button type="button" onClick={() => { touched.current = true; editor.chain().focus().toggleItalic().run(); }} className={editor.isActive('italic') ? 'is-active' : undefined}>I</button>
              <span className="sep" />
              <button type="button" onClick={() => { touched.current = true; editor.chain().focus().toggleHeading({ level: 4 }).run(); }}>H4</button>
              <button type="button" onClick={() => { touched.current = true; editor.chain().focus().toggleBulletList().run(); }}>• List</button>
              <button type="button" onClick={() => { touched.current = true; editor.chain().focus().toggleOrderedList().run(); }}>1. List</button>
              <span className="sep" />
              <button type="button" onClick={() => { touched.current = true; editor.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run(); }}>Table</button>
              <button type="button" onClick={() => { touched.current = true; editor.chain().focus().addRowAfter().run(); }}>+Row</button>
              <button type="button" onClick={() => { touched.current = true; editor.chain().focus().deleteRow().run(); }}>−Row</button>
              <span className="sep" />
              <button type="button" onClick={() => {
                const url = window.prompt('Link URL', editor.getAttributes('link').href ?? '');
                if (url === null) return;
                touched.current = true;
                if (url === '') editor.chain().focus().unsetLink().run();
                else editor.chain().focus().setLink({ href: url }).run();
              }}>Link</button>
              <button type="button" onClick={() => {
                const src = window.prompt('Image URL (paste a link — uploads are not used)');
                if (!src) return;
                touched.current = true;
                editor.chain().focus().setImage({ src }).run();
              }}>Image</button>
            </>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--a-muted)', padding: '4px 6px' }}>
              Source view — edits are saved exactly as written.
            </span>
          )}
        </div>

        {mode === 'html' ? (
          <textarea
            className="a-textarea"
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            style={{ minHeight, border: 0, borderRadius: 0, width: '100%' }}
            spellCheck={false}
          />
        ) : (
          <div style={{ minHeight }} onKeyDown={() => { touched.current = true; }}>
            <EditorContent editor={editor} />
          </div>
        )}
      </div>

      {mode === 'visual' && lossy ? (
        <p className="a-msg a-msg-error" role="alert" style={{ marginTop: 8 }}>
          <strong>Careful.</strong> This content uses layout the visual editor cannot
          represent. Editing here would reduce it by about {lossPct}% (
          {html.length.toLocaleString()} → {normalisedLength.toLocaleString()} characters)
          and that loss is saved. Switch back to <strong>HTML</strong> unless you mean
          to simplify this section.
        </p>
      ) : null}

      {html.length !== original.length ? (
        <p className="a-hint" style={{ marginTop: 6 }}>
          {original.length.toLocaleString()} → {html.length.toLocaleString()} characters
          {html.length < original.length * 0.8 ? ' — a large reduction; check before saving.' : ''}
        </p>
      ) : null}

      <textarea name={name} value={html} readOnly hidden />
    </>
  );
}
