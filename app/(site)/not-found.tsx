import type { Metadata } from 'next';

/**
 * The styled 404, transcribed from the reference's response for an unknown path.
 *
 * The reference reuses the generic homepage <title> here, which is why title
 * alone cannot be used to tell a real page from a 404 — the status code is the
 * only reliable signal, and that mattered when mapping the site.
 */
export const metadata: Metadata = {
  title: 'Online & Distance Education Courses | UPIT College of Education',
};

export default function NotFound() {
  return (
    <section>
      <div className="container">
        <div className="align-items-center row">
          <div className="text-center mx-auto col-md-10">
            <img src="/new-assets/img/error.svg" className="h-lg-500px mb-4" />
            <h1 className="display-1 text-blue mb-0 fw-bold">404</h1>
            <h2 className="fw-bold">Oh no, something went wrong!</h2>
            <p className="mb-4">
              Either something went wrong or this page doesn&apos;t exist anymore.
            </p>
            <a className="btn btn-light fw-bold mb-3" href="/">
              Take me to Homepage
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
