/**
 * Shared breadcrumb header used by the course, university, specialization and
 * blog detail templates.
 *
 * Markup transcribed from the live output:
 *   <ul class="page-list">
 *     <li class="rbt-breadcrumb-item"><a href="/">Home</a></li>
 *     <li><div class="icon-right"><i class="feather-chevron-right"></i></div></li>
 *     <li class="rbt-breadcrumb-item active">Name</li>
 *   </ul>
 * The chevron is a real <li> between each pair, not CSS — omitting it would
 * change both the DOM and the rendered row.
 */
import { Fragment } from 'react';

export type Crumb = { label: string; href?: string };

export default function Breadcrumb({
  title,
  crumbs,
}: {
  title: string;
  crumbs: Crumb[];
}) {
  return (
    <div className="rbt-breadcrumb-default ptb--50 ptb_md--50 ptb_sm--30 bg-gradient-1">
      <div className="container">
        <div className="row">
          <div className="col-lg-12">
            <div className="breadcrumb-inner text-center">
              <h4 className="title">{` ${title} `}</h4>
              <ul className="page-list">
                {/* The {" "} between list items is load-bearing: .page-list lays
                    its items out inline, so the newline in the live markup
                    renders as a real space. Dropping it closes the gap. */}
                {crumbs.map((c, i) => (
                  <Fragment key={i}>
                    {i > 0 && (
                      <>
                        {' '}
                        <li>
                          <div className="icon-right">
                            <i className="feather-chevron-right"></i>
                          </div>
                        </li>{' '}
                      </>
                    )}
                    <li className={c.href ? 'rbt-breadcrumb-item' : 'rbt-breadcrumb-item active'}>
                      {c.href ? <a href={c.href}>{c.label}</a> : ` ${c.label} `}
                    </li>
                  </Fragment>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
