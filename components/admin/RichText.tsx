'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { useEffect, useState } from 'react';

/**
 * WYSIWYG editor for one HTML section.
 *
 * Tables are essential, not a nicety: the migrated college content stores Key
 * Features, Admission Process and Reviews as tables on several colleges, and an
 * editor without table support would silently destroy them on first save.
 *
 * The value is mirrored into a hidden <textarea> so the surrounding <form> posts
 * it like any other field — no controlled-component plumbing through the Server
 * Action, and the form still works if the editor fails to mount.
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
  const [html, setHtml] = useState(initialHtml ?? '');
  const [mounted, setMounted] = useState(false);

  const editor = useEditor({
    // Rendering the editor during SSR would mismatch on hydration.
    immediatelyRender: false,
    extensions: [
      // StarterKit already bundles Link in this tiptap version; registering
      // @tiptap/extension-link alongside it warns about a duplicate extension
      // name and the second registration is ignored. Configure it through
      // StarterKit instead.
      StarterKit.configure({ link: { openOnClick: false } }),
      Image,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: initialHtml ?? '',
    onUpdate: ({ editor }) => setHtml(editor.getHTML()),
  });

  useEffect(() => setMounted(true), []);

  if (!mounted || !editor) {
    // Before mount, still post the original value so a save cannot blank it.
    return (
      <>
        <textarea className="a-textarea" name={name} defaultValue={initialHtml ?? ''} />
        <p className="a-hint">Loading editor…</p>
      </>
    );
  }

  const btn = (label: string, active: boolean, onClick: () => void, title?: string) => (
    <button
      type="button"
      title={title ?? label}
      className={active ? 'is-active' : undefined}
      onClick={onClick}
    >
      {label}
    </button>
  );

  return (
    <>
      <div className="a-editor">
        <div className="a-editor-toolbar">
          {btn('B', editor.isActive('bold'), () => editor.chain().focus().toggleBold().run())}
          {btn('I', editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run())}
          <span className="sep" />
          {btn('P', editor.isActive('paragraph'), () =>
            editor.chain().focus().setParagraph().run()
          )}
          {btn('H4', editor.isActive('heading', { level: 4 }), () =>
            editor.chain().focus().toggleHeading({ level: 4 }).run()
          )}
          {btn('H5', editor.isActive('heading', { level: 5 }), () =>
            editor.chain().focus().toggleHeading({ level: 5 }).run()
          )}
          <span className="sep" />
          {btn('• List', editor.isActive('bulletList'), () =>
            editor.chain().focus().toggleBulletList().run()
          )}
          {btn('1. List', editor.isActive('orderedList'), () =>
            editor.chain().focus().toggleOrderedList().run()
          )}
          <span className="sep" />
          {btn('Table', editor.isActive('table'), () =>
            editor.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run()
          , 'Insert a 3x2 table')}
          {btn('+Row', false, () => editor.chain().focus().addRowAfter().run(), 'Add row below')}
          {btn('+Col', false, () => editor.chain().focus().addColumnAfter().run(), 'Add column right')}
          {btn('−Row', false, () => editor.chain().focus().deleteRow().run(), 'Delete row')}
          {btn('−Col', false, () => editor.chain().focus().deleteColumn().run(), 'Delete column')}
          <span className="sep" />
          {btn('Link', editor.isActive('link'), () => {
            const url = window.prompt('Link URL', editor.getAttributes('link').href ?? '');
            if (url === null) return;
            if (url === '') editor.chain().focus().unsetLink().run();
            else editor.chain().focus().setLink({ href: url }).run();
          })}
          {btn('Image', false, () => {
            const src = window.prompt('Image URL (paste a link — uploads are not used)');
            if (src) editor.chain().focus().setImage({ src }).run();
          })}
          <span className="sep" />
          {btn('Clear', false, () =>
            editor.chain().focus().clearNodes().unsetAllMarks().run()
          , 'Remove formatting')}
        </div>
        <div style={{ minHeight }}>
          <EditorContent editor={editor} />
        </div>
      </div>
      <textarea name={name} value={html} readOnly hidden />
    </>
  );
}
