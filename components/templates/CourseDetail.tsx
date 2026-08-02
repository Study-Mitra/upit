import Breadcrumb from './Breadcrumb';
import { escapeHtml } from '@/lib/html';
import type { Course } from '@/lib/models/courses';

/**
 * /course/{slug} detail template — 47 of the 49 course pages.
 *
 * The page is a fixed shell around ONE free-form WYSIWYG blob (`descriptionHtml`).
 * That blob's internal structure differs completely between courses — mba-regular
 * uses .course-detail-section wrappers, phd-in-nursing uses bare h3/h4 — which is
 * why it is rendered as raw HTML rather than re-derived from structured fields.
 * Re-deriving it would guarantee drift.
 *
 * The "Universities Offering" block is optional: present on 28 of 49 pages.
 */
export default function CourseDetail({ course }: { course: Course }) {
  const unis = course.universitiesOffering;

  return (
    <>
      <Breadcrumb
        title={course.name}
        crumbs={[{ label: 'Home', href: '/' }, { label: course.name }]}
      />

      <div className="rbt-course-details-area ptb--60">
        <div className="container">
          <div className="row g-5">
            <div className="col-lg-8">
              <div className="course-details-content">
                {/* Start Course Feature Box  */}
                <div
                  className="rbt-course-feature-box overview-wrapper rbt-border-with-box  shadow "
                  id="overview"
                >
                  {/* The heading and the WYSIWYG blob share one innerHTML on
                      purpose. Rendering the blob inside its own <div> would add
                      a wrapper element the live DOM does not have, shifting
                      every descendant's position. */}
                  <div
                    className="rbt-course-feature-inner has-show-more-inner-content"
                    dangerouslySetInnerHTML={{
                      __html:
                        `<div class="section-title"><h4 class="rbt-title-style-3">${escapeHtml(course.aboutHeading)}</h4></div>` +
                        course.descriptionHtml,
                    }}
                  />
                </div>
                {/* End Course Feature Box  */}
              </div>
            </div>

            <div className="col-lg-4">
              <div className="course-sidebar sticky-top rbt-shadow-box rbt-gradient-border">
                <div className="inner">
                  <div className="content-item-content">
                    {/* Course Image */}
                    <div className="mb-4">
                      <img src={course.bannerImage} className="w-100 rounded" alt="" />
                    </div>

                    {/* Fees */}
                    <div className="rbt-price-wrapper d-flex flex-wrap align-items-center justify-content-between">
                      <div className="rbt-price">
                        <h4 className="title ">
                          <strong className="color-primary">{` ${course.name} `}</strong>
                        </h4>
                      </div>
                    </div>

                    {/* Apply */}
                    <div className="add-to-card-button mt--15">
                      <button
                        type="button"
                        data-bs-toggle="modal"
                        data-bs-target="#pop"
                        className="rbt-btn btn-gradient icon-hover w-100"
                      >
                        {/* The space between these two spans renders — both
                            are inline-block. */}
                        <span className="btn-text">{' Apply Now '}</span>{' '}
                        <span className="btn-icon">
                          <i className="feather-arrow-right"></i>
                        </span>
                      </button>
                    </div>

                    {/* Brochure */}
                    <span className="subtitle">
                      <i className="feather-award"></i>
                      {" Admission Open "}
                    </span>

                    {/* Course Details */}
                    <div className="rbt-widget-details mt--30">
                      <ul className="rbt-course-details-list-wrapper">
                        {course.details.map((d, i) =>
                          d.style === 'block' ? (
                            <li key={i} className="flex-column align-items-start gap-1">
                              <span
                                className="text-dark fw-bold"
                                style={{ fontSize: '13px' }}
                              >
                                <i className={d.icon}></i>
                                {d.label}
                              </span>
                              <div
                                className="w-100 mt-1 p-2 rounded"
                                style={{
                                  background: '#f8f4f1',
                                  border: '1px solid #ffd7b2',
                                  fontSize: '12px',
                                  lineHeight: '1.4',
                                  color: '#475569',
                                  fontWeight: '500',
                                }}
                              >
                                {` ${d.value} `}
                              </div>
                            </li>
                          ) : (
                            <li key={i}>
                              <span className="text-dark">
                                <i className={d.icon}></i>
                                {d.label}
                              </span>
                              <span className="rbt-feature-value rbt-badge-5">
                                {` ${d.value} `}
                              </span>
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {unis && (
        <div className="rbt-top-course-area mb--100">
          <div className="container">
            <div className="related-course mt--30">
              <div className="row g-5 text-center mb--40">
                <div className="col-lg-12">
                  <div className="section-title">
                    <h4 className="title ">
                      {'Universities Offering '}
                      <strong className="color-primary">{` ${course.name} `}</strong>
                    </h4>
                  </div>
                </div>
              </div>
              <div
                className="swiper universitiesSwiper pt--10"
                style={{ paddingBottom: '40px' }}
              >
                <div className="swiper-wrapper">
                  {unis.cards.map((u, i) => (
                    <div
                      key={i}
                      className="swiper-slide h-auto shadow rounded overflow-hidden"
                    >
                      <div className="rbt-card variation-01 rbt-hover h-100 d-flex flex-column">
                        <div
                          className="rbt-card-img d-flex align-items-center justify-content-center p-3"
                          style={{ background: '#fff', borderBottom: '1px solid #e5e7eb' }}
                        >
                          <a
                            href={u.href}
                            className="d-flex align-items-center justify-content-center"
                            style={{
                              width: '120px',
                              height: '60px',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              background: '#fff',
                              padding: '6px',
                            }}
                          >
                            <img
                              src={u.logo}
                              alt={u.logoAlt}
                              style={{
                                maxWidth: '100%',
                                maxHeight: '100%',
                                objectFit: 'contain',
                              }}
                            />
                          </a>
                        </div>
                        <div className="rbt-card-body d-flex flex-column justify-content-between flex-grow-1 p-3">
                          <div>
                            <h4
                              className="rbt-card-title text-center"
                              style={{ fontSize: '15px', marginBottom: '8px' }}
                            >
                              <a href={u.href}>{u.name}</a>
                            </h4>
                            <p
                              className="rbt-card-text text-center text-warning fw-bold mb-3"
                              style={{ fontSize: '13px' }}
                            >
                              {u.feeText}
                            </p>
                          </div>
                          <div className="rbt-card-bottom text-center">
                            <a className="course-btn w-100" href={u.href}>
                              {'View University '}
                              <i className="feather-arrow-right"></i>
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="swiper-button-prev"></div>
                <div className="swiper-button-next"></div>
                <div className="swiper-pagination"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {course.faqHtml && (
        <div dangerouslySetInnerHTML={{ __html: course.faqHtml }} />
      )}
    </>
  );
}
