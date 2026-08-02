'use client';

import { useEffect } from 'react';

/**
 * Narrow the Apply form's course dropdown to what this college actually offers.
 *
 * THE PROBLEM
 * LeadModal is global chrome rendered from the root layout, so it cannot know
 * which college page it is sitting on. Its <select> carries 48 hardcoded options
 * covering every course on the site, which means assigning courses to a college
 * in the admin had no effect on the enquiry form — a visitor on one college's
 * page could apply for a course it does not run, and the lead would be wrong.
 *
 * The two lists are also named differently: the modal was built from the
 * `courses` collection ("BBA", "B.Tech") while a college's relation points at
 * `courseCategories` ("Online & Distance BBA"). Filtering the existing options by
 * name would silently match almost nothing, so the options are REPLACED with the
 * college's own list rather than filtered.
 *
 * Done on the client because the modal lives outside this page's React tree.
 * The original options are kept in a data attribute so navigating to a page
 * without a scope restores the full list.
 */
export default function ApplyCourseScope({ courses }: { courses: string[] }) {
  useEffect(() => {
    const select = document.querySelector<HTMLSelectElement>('#course_apply_now');
    if (!select) return;

    // Preserve the full list once, so this is reversible.
    if (!select.dataset.fullOptions) {
      select.dataset.fullOptions = select.innerHTML;
    }

    if (!courses.length) {
      // No courses assigned — showing everything is better than an empty form.
      select.innerHTML = select.dataset.fullOptions;
      return;
    }

    const placeholder = '<option value="">Select Course</option>';
    const escape = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    select.innerHTML =
      placeholder +
      courses.map((c) => `<option value="${escape(c)}">${escape(c)}</option>`).join('');

    return () => {
      // Restore on unmount so a client-side navigation away does not leave the
      // shared modal scoped to the college the visitor just left.
      if (select.dataset.fullOptions) select.innerHTML = select.dataset.fullOptions;
    };
  }, [courses]);

  return null;
}
