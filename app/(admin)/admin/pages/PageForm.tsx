'use client';

import { useActionState } from 'react';
import RichText from '@/components/admin/RichText';
import { updatePage, type SaveState } from './actions';
import type { PageDoc } from '@/lib/models/pages';

const INITIAL: SaveState = { error: null };

/**
 * Edit one generic page.
 *
 * The whole content region is a single HTML field, matching how these documents
 * are stored. Unlike colleges, there is no shared section structure across the
 * blog / specialization / static families to split on, so one editor is the
 * honest representation rather than an invented schema.
 */
export default function PageForm({ page, saved }: { page: PageDoc; saved?: boolean }) {
  const [state, formAction, pending] = useActionState(updatePage, INITIAL);

  return (
    <form action={formAction}>
      {state.error ? (
        <p className="a-msg a-msg-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok || saved ? (
        <p className="a-msg a-msg-success" role="status">
          Saved. The public page is updated.
        </p>
      ) : null}

      <input type="hidden" name="path" value={page.path} />

      <div className="a-card a-card-pad" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Basics</h2>
        <div className="a-row">
          <div className="a-field">
            <label htmlFor="name">Title</label>
            <input className="a-input" id="name" name="name" defaultValue={page.name ?? ''} />
          </div>
          <div className="a-field">
            <label>
              Path<span className="a-hint">fixed</span>
            </label>
            <input className="a-input" value={page.path} readOnly />
            <p className="a-hint">Family: {page.family}</p>
          </div>
        </div>
      </div>

      <div className="a-card a-card-pad" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Content</h2>
        <p className="a-hint" style={{ marginTop: 0, marginBottom: 10 }}>
          This is the page&apos;s whole content region. Large pages may take a moment to load.
        </p>
        <RichText name="contentHtml" initialHtml={page.contentHtml ?? ''} minHeight={460} />
      </div>

      <div className="a-card a-card-pad" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>SEO</h2>
        <div className="a-field">
          <label htmlFor="seoTitle">Title</label>
          <input className="a-input" id="seoTitle" name="seoTitle" defaultValue={page.seo?.title ?? ''} />
        </div>
        <div className="a-field">
          <label htmlFor="seoDescription">Description</label>
          <textarea
            className="a-textarea"
            id="seoDescription"
            name="seoDescription"
            defaultValue={page.seo?.description ?? ''}
            style={{ minHeight: 70 }}
          />
        </div>
        <div className="a-field">
          <label htmlFor="seoKeywords">Keywords</label>
          <input
            className="a-input"
            id="seoKeywords"
            name="seoKeywords"
            defaultValue={page.seo?.keywords ?? ''}
          />
        </div>
      </div>

      <div className="a-toolbar">
        <button className="a-btn a-btn-primary" type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </button>
        <a className="a-btn" href="/admin/pages">
          Cancel
        </a>
        <a className="a-btn" href={page.path} target="_blank" rel="noreferrer">
          View public page
        </a>
      </div>
    </form>
  );
}
