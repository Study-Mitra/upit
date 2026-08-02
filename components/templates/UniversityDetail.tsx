import type { University } from '@/lib/models/universities';
import type { CourseCategory } from '@/lib/models/course-categories';
import ApplyCourseScope from '@/components/chrome/ApplyCourseScope';

/**
 * College detail page, rendered from structured fields instead of one HTML blob.
 *
 * FIDELITY NOTES
 * The hero and the sticky nav are reproduced from the live markup. The six body
 * sections are stored HTML, injected into the wrapper the theme expects:
 *
 *   <div class="rbt-course-feature-box overview-wrapper rbt-border-with-box mt--30" id="…">
 *
 * That wrapper class is identical for every section on every college, so it lives
 * here rather than in the database. Each stored fragment keeps its own
 * `.section-title` heading, which is why nothing is re-injected mid-markup.
 *
 * The section ids are load-bearing: the sticky one-page nav links to them and
 * main.js's onePageNav scroll-spy tracks them.
 */

/** The wrapper every section box uses on the live site. */
const BOX = 'rbt-course-feature-box overview-wrapper rbt-border-with-box mt--30';

function Section({ id, html }: { id: string; html: string }) {
  if (!html) return null;
  return <div className={BOX} id={id} dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function UniversityDetail({
  university: u,
  courses,
}: {
  university: University;
  courses: CourseCategory[];
}) {
  const badges = (u.approvals?.length ? u.approvals.map((a) => a.label) : u.badges) ?? [];
  const heading = u.detailName || u.name;

  return (
    <main className="main">
      {/* Scope the shared Apply form to this college's courses; without it the
          enquiry dropdown offers every course on the site regardless of what
          this college actually runs. */}
      <ApplyCourseScope courses={courses.map((c) => c.name)} />

      {/* ---------------- hero ---------------- */}
      <div className="rbt-breadcrumb-default rbt-breadcrumb-style-3 version-02">
        <div className="breadcrumb-inner bg-primary" />
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-7">
              <div className="content text-start">
                <ul className="page-list mb--20">
                  <li className="rbt-breadcrumb-item text-white">
                    <a href="/" style={{ color: '#b7c9cd' }}>
                      Home
                    </a>
                  </li>
                  <li>
                    <div className="icon-right">
                      <i className="feather-chevron-right" style={{ color: '#b7c9cd' }} />
                    </div>
                  </li>
                  <li className="rbt-breadcrumb-item active text-white">University</li>
                </ul>

                {/* Keyed by index: some colleges legitimately list the same
                    label twice (e.g. two UGC entries), and a label key would
                    collide. */}
                <div className="mb--20">
                  {badges.map((b, i) => (
                    <span className="rbt-badge-6 bg-white-opacity me-2 mb-2" key={`${b}-${i}`}>
                      {b}
                    </span>
                  ))}
                </div>

                <div className="d-flex align-items-center gap-3 flex-wrap mb-4">
                  {u.logo ? (
                    <img
                      src={u.logo}
                      alt={u.name}
                      className="bg-white p-2 rounded university-logo"
                    />
                  ) : null}
                  <h2 className="w-600 mb-0 text-white university-title">{heading}</h2>
                </div>

                {u.location ? (
                  <p className="mb--15 text-white">
                    <i className="feather-map-pin text-white " /> {u.location}
                  </p>
                ) : null}

                {u.excerpt ? <p className="mb--20 text-white">{u.excerpt}</p> : null}

                <hr className="divider" />

                <div className="d-flex flex-wrap gap-3 mt--30">
                  <button
                    type="button"
                    data-bs-toggle="modal"
                    data-bs-target="#pop"
                    className="rbt-btn btn-gradient"
                  >
                    Apply Now
                  </button>
                </div>
              </div>
            </div>

            <div className="col-lg-5">
              <div className="radius-10 overflow-hidden p-4 bg-color-white-opacity mt_md--30 mt_sm--60">
                <div className="text-center">
                  {u.banner ? <img src={u.banner} className="radius-10" alt={u.name} /> : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- body ---------------- */}
      <div className="rbt-course-details-area ptb--20">
        <div className="container">
          <div className="row g-5">
            <div className="col-lg-12">
              <div className="course-details-content">
                <div
                  className="rbt-inner-onepage-navigation sticky-top mt--30 bg-color-white"
                  style={{ top: 100, zIndex: 999, paddingTop: 10, paddingBottom: 10 }}
                >
                  <nav className="mainmenu-nav onepagenav">
                    <ul className="mainmenu">
                      <li className="current">
                        <a href="#overview">Overview</a>
                      </li>
                      <li>
                        <a href="#coursecontent">Approvals</a>
                      </li>
                      <li>
                        <a href="#details">Details</a>
                      </li>
                      <li>
                        <a href="#Features">Key Features</a>
                      </li>
                      <li>
                        <a href="#AdmissionProcess">Admission Process</a>
                      </li>
                      <li>
                        <a href="#CareerProspects">Career Prospects</a>
                      </li>
                      <li>
                        <a href="#Reviews">Reviews</a>
                      </li>
                    </ul>
                  </nav>
                </div>

                <Section id="overview" html={u.about ?? ''} />
                <Section id="coursecontent" html={u.approvalsHtml ?? ''} />

                {/* Courses is a relation, not stored text: it renders from courseIds. */}
                <div className={BOX} id="details">
                  <div className="rbt-course-feature-inner">
                    <div className="section-title">
                      <h4 className="rbt-title-style-3">Courses</h4>
                    </div>
                    {courses.length ? (
                      <div className="row g-4 mt--10">
                        {courses.map((c) => (
                          <div className="col-lg-3 col-md-4 col-sm-6 col-12" key={c.id}>
                            <div
                              className="card h-100 border shadow-sm text-center"
                              style={{ borderRadius: 12, overflow: 'hidden' }}
                            >
                              <div className="card-body px-2 py-3">
                                <h6
                                  className="mb-0"
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: '#1a2d5a',
                                    lineHeight: 1.3,
                                  }}
                                >
                                  {c.name}
                                </h6>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt--10">Course details coming soon.</p>
                    )}
                  </div>
                </div>

                <Section id="Features" html={u.keyFeatures ?? ''} />
                <Section id="AdmissionProcess" html={u.admissionProcess ?? ''} />
                <Section id="CareerProspects" html={u.careerProcess ?? ''} />
                <Section id="Reviews" html={u.reviews ?? ''} />

                {/* Only LPU carries an FAQ block; absent elsewhere. */}
                {(u as University & { faqHtml?: string }).faqHtml ? (
                  <div
                    className="rbt-accordion-area accordion-style-1 mt--30"
                    dangerouslySetInnerHTML={{
                      __html: (u as University & { faqHtml?: string }).faqHtml as string,
                    }}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
