'use client';

import { useActionState, useState } from 'react';
import RichText from '@/components/admin/RichText';
import { createCollege, updateCollege, type SaveState } from './actions';
import type { Approval, University } from '@/lib/models/universities';

const INITIAL: SaveState = { error: null };

type CourseOption = { id: string; name: string };

/**
 * Create/edit form for a college.
 *
 * The five HTML sections use the tiptap editor; Approvals is a repeatable
 * label+URL list; Courses is a checkbox list because it is a relation to the
 * courses collection, not free text. Media is a URL field throughout — nothing
 * is uploaded.
 */
export default function CollegeForm({
  college,
  courses,
  mode,
  saved,
}: {
  college: Partial<University>;
  courses: CourseOption[];
  mode: 'create' | 'edit';
  saved?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    mode === 'create' ? createCollege : updateCollege,
    INITIAL
  );

  const [approvals, setApprovals] = useState<Approval[]>(
    college.approvals?.length
      ? college.approvals
      : (college.badges ?? []).map((label) => ({ label, logoUrl: '' }))
  );
  const [selected, setSelected] = useState<string[]>(college.courseIds ?? []);

  const toggleCourse = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

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

      {/* ---------------- identity ---------------- */}
      <div className="a-card a-card-pad" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Basics</h2>

        <div className="a-row">
          <div className="a-field">
            <label htmlFor="name">Name *</label>
            <input className="a-input" id="name" name="name" defaultValue={college.name ?? ''} required />
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
              defaultValue={college.slug ?? ''}
              required
              readOnly={mode === 'edit'}
              pattern="[a-z0-9\-]+"
            />
            <p className="a-hint">
              Public URL: /university/{college.slug || 'your-slug'}
            </p>
          </div>
        </div>

        <div className="a-row">
          <div className="a-field">
            <label htmlFor="location">Location</label>
            <input
              className="a-input"
              id="location"
              name="location"
              defaultValue={college.location ?? ''}
              placeholder="Jamshedpur, Jharkhand"
            />
          </div>
          <div className="a-field">
            <label htmlFor="compareName">
              Compare dropdown label<span className="a-hint">defaults to Name</span>
            </label>
            <input
              className="a-input"
              id="compareName"
              name="compareName"
              defaultValue={college.compareName ?? ''}
            />
          </div>
        </div>

        <div className="a-row">
          <div className="a-field">
            <label htmlFor="logo">
              Logo URL<span className="a-hint">paste a link</span>
            </label>
            <input className="a-input" id="logo" name="logo" defaultValue={college.logo ?? ''} />
          </div>
          <div className="a-field">
            <label htmlFor="banner">
              Banner URL<span className="a-hint">hero + listing card</span>
            </label>
            <input className="a-input" id="banner" name="banner" defaultValue={college.banner ?? ''} />
          </div>
        </div>

        <div className="a-field">
          <label htmlFor="detailName">
            Detail heading<span className="a-hint">defaults to Name</span>
          </label>
          <input
            className="a-input"
            id="detailName"
            name="detailName"
            defaultValue={college.detailName ?? ''}
          />
        </div>

        <div className="a-field">
          <label htmlFor="excerpt">Short intro</label>
          <textarea
            className="a-textarea"
            id="excerpt"
            name="excerpt"
            defaultValue={college.excerpt ?? ''}
            style={{ minHeight: 80 }}
          />
          <p className="a-hint">Shown in the hero and truncated on the listing card.</p>
        </div>

        {mode === 'edit' ? (
          <p className="a-hint">
            Compare ID <strong>{college.compareId}</strong> — allocated automatically and fixed,
            because the comparison feature keys off it.
          </p>
        ) : (
          <p className="a-hint">A Compare ID will be allocated automatically on save.</p>
        )}
      </div>

      {/* ---------------- approvals ---------------- */}
      <div className="a-card a-card-pad" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Approvals</h2>
        <p className="a-hint" style={{ marginTop: 0 }}>
          Labels also become the pills on the listing card and in the hero.
        </p>

        {approvals.map((a, i) => (
          <div className="a-row" key={i} style={{ alignItems: 'end' }}>
            <div className="a-field">
              <label>Label</label>
              <input
                className="a-input"
                name="approvalLabel"
                defaultValue={a.label}
                placeholder="UGC"
              />
            </div>
            <div className="a-field">
              <label>Logo URL</label>
              <input
                className="a-input"
                name="approvalLogo"
                defaultValue={a.logoUrl}
                placeholder="/new-assets/img/approvals/ugc_banner.png"
              />
            </div>
            <div className="a-field">
              <button
                type="button"
                className="a-btn a-btn-danger"
                onClick={() => setApprovals(approvals.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          className="a-btn"
          onClick={() => setApprovals([...approvals, { label: '', logoUrl: '' }])}
        >
          Add approval
        </button>
      </div>

      {/* ---------------- courses relation ---------------- */}
      <div className="a-card a-card-pad" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Courses offered</h2>
        <p className="a-hint" style={{ marginTop: 0 }}>
          Drives the Courses carousel on the detail page and the course filter on the listing.
          {selected.length === 0 ? ' Currently none — the carousel will be empty.' : ''}
        </p>

        <input type="hidden" name="courseIds" value={selected.join(',')} />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 4,
            maxHeight: 260,
            overflowY: 'auto',
          }}
        >
          {courses.map((c) => (
            <label key={c.id} style={{ display: 'flex', gap: 8, fontWeight: 400, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={selected.includes(c.id)}
                onChange={() => toggleCourse(c.id)}
              />
              <span>{c.name}</span>
            </label>
          ))}
        </div>
        {courses.length === 0 ? <p className="a-hint">No courses in the database.</p> : null}
      </div>

      {/* ---------------- study modes ---------------- */}
      <div className="a-card a-card-pad" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Study modes</h2>
        <div className="a-field">
          <label htmlFor="modeIds">
            Mode IDs<span className="a-hint">comma separated — drives the mode-of-study filter</span>
          </label>
          <input
            className="a-input"
            id="modeIds"
            name="modeIds"
            defaultValue={(college.modeIds ?? []).join(', ')}
          />
        </div>
      </div>

      {/* ---------------- the five HTML sections ---------------- */}
      {(
        [
          ['about', 'About', 'The opening description.'],
          ['approvalsHtml', 'Approvals section', 'The logo strip shown under the Approvals heading.'],
          ['keyFeatures', 'Key features', 'A table on most colleges; a list on some. Both are fine.'],
          ['admissionProcess', 'Admission process', 'Steps, as a list or a table.'],
          ['careerProcess', 'Career process', 'Outcomes and career paths.'],
          ['reviews', 'Reviews', 'Summary paragraph or table.'],
        ] as const
      ).map(([field, label, hint]) => (
        <div className="a-card a-card-pad" style={{ marginBottom: 18 }} key={field}>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>{label}</h2>
          <p className="a-hint" style={{ marginTop: 0, marginBottom: 10 }}>
            {hint}
          </p>
          <RichText name={field} initialHtml={(college[field] as string) ?? ''} />
        </div>
      ))}

      {/* ---------------- seo ---------------- */}
      <div className="a-card a-card-pad" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>SEO</h2>
        <div className="a-field">
          <label htmlFor="seoTitle">Title</label>
          <input
            className="a-input"
            id="seoTitle"
            name="seoTitle"
            defaultValue={college.seo?.title ?? ''}
          />
        </div>
        <div className="a-field">
          <label htmlFor="seoDescription">Description</label>
          <textarea
            className="a-textarea"
            id="seoDescription"
            name="seoDescription"
            defaultValue={college.seo?.description ?? ''}
            style={{ minHeight: 70 }}
          />
        </div>
        <div className="a-field">
          <label htmlFor="seoKeywords">Keywords</label>
          <input
            className="a-input"
            id="seoKeywords"
            name="seoKeywords"
            defaultValue={college.seo?.keywords ?? ''}
          />
        </div>
      </div>

      <div className="a-toolbar">
        <button className="a-btn a-btn-primary" type="submit" disabled={pending}>
          {pending ? 'Saving…' : mode === 'create' ? 'Create college' : 'Save changes'}
        </button>
        <a className="a-btn" href="/admin/colleges">
          Cancel
        </a>
        {mode === 'edit' && college.slug ? (
          <a className="a-btn" href={`/university/${college.slug}`} target="_blank" rel="noreferrer">
            View public page
          </a>
        ) : null}
      </div>
    </form>
  );
}
