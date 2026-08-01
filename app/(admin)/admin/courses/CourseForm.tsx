'use client';

import { useActionState, useState } from 'react';
import RichText from '@/components/admin/RichText';
import { createCourse, updateCourse, type SaveState } from './actions';
import type { Course, CourseDetailRow } from '@/lib/models/courses';

const INITIAL: SaveState = { error: null };

/**
 * Create/edit form for a course.
 *
 * `details` is a repeatable row list rather than rich text because the public
 * template renders each row itself, switching on `style`: 'block' is the
 * full-width panel (Eligibility) and 'badge' is a pill. Storing it as prose would
 * lose that distinction.
 */
export default function CourseForm({
  course,
  mode,
  saved,
}: {
  course: Partial<Course>;
  mode: 'create' | 'edit';
  saved?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    mode === 'create' ? createCourse : updateCourse,
    INITIAL
  );

  const [kind, setKind] = useState<Course['kind']>(course.kind ?? 'detail');
  const [details, setDetails] = useState<CourseDetailRow[]>(course.details ?? []);

  const addRow = () =>
    setDetails([...details, { icon: '', label: '', value: '', style: 'badge' }]);

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

      <div className="a-card a-card-pad" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Basics</h2>

        <div className="a-row">
          <div className="a-field">
            <label htmlFor="name">Name *</label>
            <input className="a-input" id="name" name="name" defaultValue={course.name ?? ''} required />
          </div>
          <div className="a-field">
            <label htmlFor="slug">
              URL slug *
              <span className="a-hint">
                {mode === 'edit' ? 'cannot be changed' : 'lowercase, hyphens'}
              </span>
            </label>
            <input
              className="a-input"
              id="slug"
              name="slug"
              defaultValue={course.slug ?? ''}
              required
              readOnly={mode === 'edit'}
              pattern="[a-z0-9\-]+"
            />
            <p className="a-hint">Public URL: /course/{course.slug || 'your-slug'}</p>
          </div>
        </div>

        <div className="a-row">
          <div className="a-field">
            <label htmlFor="kind">Page type</label>
            <select
              className="a-select"
              id="kind"
              name="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as Course['kind'])}
            >
              <option value="detail">Detail — a single course</option>
              <option value="listing">Listing — an index of courses</option>
            </select>
            <p className="a-hint">
              {kind === 'listing'
                ? 'Listing pages render a free-form body instead of the details table.'
                : 'Detail pages render the details rows and the description.'}
            </p>
          </div>
          <div className="a-field">
            <label htmlFor="bannerImage">
              Banner URL<span className="a-hint">paste a link</span>
            </label>
            <input
              className="a-input"
              id="bannerImage"
              name="bannerImage"
              defaultValue={course.bannerImage ?? ''}
            />
          </div>
        </div>

        <div className="a-field">
          <label htmlFor="aboutHeading">About heading</label>
          <input
            className="a-input"
            id="aboutHeading"
            name="aboutHeading"
            defaultValue={course.aboutHeading ?? ''}
          />
        </div>
      </div>

      {/* ---------------- details rows (detail pages only) ---------------- */}
      {kind === 'detail' ? (
        <div className="a-card a-card-pad" style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>Details</h2>
          <p className="a-hint" style={{ marginTop: 0 }}>
            &quot;Block&quot; renders as the full-width panel (used for Eligibility);
            &quot;Badge&quot; renders as a pill.
          </p>

          {details.map((row, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1.6fr 1.4fr 0.7fr auto',
                gap: 10,
                alignItems: 'end',
                marginBottom: 10,
              }}
            >
              <div className="a-field" style={{ margin: 0 }}>
                <label>Label</label>
                <input className="a-input" name="detailLabel" defaultValue={row.label} />
              </div>
              <div className="a-field" style={{ margin: 0 }}>
                <label>Value</label>
                <input className="a-input" name="detailValue" defaultValue={row.value} />
              </div>
              <div className="a-field" style={{ margin: 0 }}>
                <label>
                  Icon class<span className="a-hint">feather/fa</span>
                </label>
                <input className="a-input" name="detailIcon" defaultValue={row.icon} />
              </div>
              <div className="a-field" style={{ margin: 0 }}>
                <label>Style</label>
                <select className="a-select" name="detailStyle" defaultValue={row.style}>
                  <option value="badge">Badge</option>
                  <option value="block">Block</option>
                </select>
              </div>
              <button
                type="button"
                className="a-btn a-btn-danger"
                onClick={() => setDetails(details.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </div>
          ))}

          <button type="button" className="a-btn" onClick={addRow}>
            Add detail row
          </button>
          {details.length === 0 ? (
            <p className="a-hint">No detail rows — the details panel will be empty.</p>
          ) : null}
        </div>
      ) : null}

      {/* ---------------- description ---------------- */}
      <div className="a-card a-card-pad" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Description</h2>
        <RichText name="descriptionHtml" initialHtml={course.descriptionHtml ?? ''} />
      </div>

      {kind === 'listing' ? (
        <div className="a-card a-card-pad" style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>Listing body</h2>
          <p className="a-hint" style={{ marginTop: 0, marginBottom: 10 }}>
            Only used by listing pages such as /course/online.
          </p>
          <RichText name="bodyHtml" initialHtml={course.bodyHtml ?? ''} />
        </div>
      ) : null}

      <div className="a-card a-card-pad" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>FAQ</h2>
        <p className="a-hint" style={{ marginTop: 0, marginBottom: 10 }}>
          Optional accordion. Leave empty to hide it.
        </p>
        <RichText name="faqHtml" initialHtml={course.faqHtml ?? ''} />
      </div>

      <div className="a-card a-card-pad" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>SEO</h2>
        <div className="a-field">
          <label htmlFor="seoTitle">Title</label>
          <input className="a-input" id="seoTitle" name="seoTitle" defaultValue={course.seo?.title ?? ''} />
        </div>
        <div className="a-field">
          <label htmlFor="seoDescription">Description</label>
          <textarea
            className="a-textarea"
            id="seoDescription"
            name="seoDescription"
            defaultValue={course.seo?.description ?? ''}
            style={{ minHeight: 70 }}
          />
        </div>
        <div className="a-field">
          <label htmlFor="seoKeywords">Keywords</label>
          <input
            className="a-input"
            id="seoKeywords"
            name="seoKeywords"
            defaultValue={course.seo?.keywords ?? ''}
          />
        </div>
      </div>

      <div className="a-toolbar">
        <button className="a-btn a-btn-primary" type="submit" disabled={pending}>
          {pending ? 'Saving…' : mode === 'create' ? 'Create course' : 'Save changes'}
        </button>
        <a className="a-btn" href="/admin/courses">
          Cancel
        </a>
        {mode === 'edit' && course.slug ? (
          <a className="a-btn" href={`/course/${course.slug}`} target="_blank" rel="noreferrer">
            View public page
          </a>
        ) : null}
      </div>
    </form>
  );
}
