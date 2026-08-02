import Breadcrumb from './Breadcrumb';
import type { University } from '@/lib/models/universities';

/**
 * /compare/{slug}/{slug}[/{slug}] — the comparison result table.
 *
 * Dynamic, never prerendered: 19 universities give 171 pairs and 969 triples.
 *
 * The row set is fixed (captured from the reference) and most cells read "N/A"
 * there too — the underlying records simply do not carry those fields. Values
 * are filled from the `universities` collection where they exist, which is also
 * what the admin will edit.
 */
const ROWS: { label: string; key: keyof CompareFields }[] = [
  { label: 'Collage Name', key: 'name' },
  { label: 'Location', key: 'location' },
  { label: 'Establishment Year', key: 'establishmentYear' },
  { label: 'Sample Certificate', key: 'sampleCertificate' },
  { label: 'Course Name', key: 'courseName' },
  { label: 'Course Fee', key: 'courseFee' },
  { label: 'Education Mode', key: 'educationMode' },
  { label: 'NAAC Grade', key: 'naacGrade' },
  { label: 'NIRF Ranking', key: 'nirfRanking' },
  { label: 'Examination Mode', key: 'examinationMode' },
  { label: 'WES International Approvals', key: 'wesApprovals' },
  { label: 'E-Learning Facilities', key: 'eLearning' },
  { label: 'Approvals', key: 'approvals' },
  { label: 'Placement Support', key: 'placementSupport' },
  { label: 'Syllabus', key: 'syllabus' },
  { label: 'Placement', key: 'placement' },
  { label: 'Credit Points', key: 'creditPoints' },
  { label: 'Eligibility', key: 'eligibility' },
  { label: 'Examination Pattern', key: 'examinationPattern' },
  { label: 'Alumni status', key: 'alumniStatus' },
  { label: 'Placement Assistance', key: 'placementAssistance' },
  { label: 'Industry Ready Curriculum', key: 'industryReadyCurriculum' },
  { label: 'Student Rating', key: 'studentRating' },
  { label: 'Satisfied Students', key: 'satisfiedStudents' },
  { label: 'Student Choice', key: 'studentChoice' },
  { label: 'Number of Students Visited', key: 'studentsVisited' },
];

export type CompareFields = {
  name: string;
  location: string;
  establishmentYear: string;
  sampleCertificate: string;
  courseName: string;
  courseFee: string;
  educationMode: string;
  naacGrade: string;
  nirfRanking: string;
  examinationMode: string;
  wesApprovals: string;
  eLearning: string;
  approvals: string;
  placementSupport: string;
  syllabus: string;
  placement: string;
  creditPoints: string;
  eligibility: string;
  examinationPattern: string;
  alumniStatus: string;
  placementAssistance: string;
  industryReadyCurriculum: string;
  studentRating: string;
  satisfiedStudents: string;
  studentChoice: string;
  studentsVisited: string;
};

/** Missing values render as "N/A", matching the reference. */
function fieldsFor(uni: University): CompareFields {
  const na = 'N/A';
  const extra = (uni as unknown as { compare?: Partial<CompareFields> }).compare ?? {};
  return {
    name: uni.name || na,
    location: uni.location || na,
    establishmentYear: extra.establishmentYear || na,
    sampleCertificate: extra.sampleCertificate || na,
    courseName: extra.courseName || na,
    courseFee: extra.courseFee || na,
    educationMode: extra.educationMode || na,
    naacGrade: extra.naacGrade || na,
    nirfRanking: extra.nirfRanking || na,
    examinationMode: extra.examinationMode || na,
    wesApprovals: extra.wesApprovals || na,
    eLearning: extra.eLearning ?? '',
    approvals: extra.approvals ?? '',
    placementSupport: extra.placementSupport ?? '',
    syllabus: extra.syllabus ?? '',
    placement: extra.placement ?? '',
    creditPoints: extra.creditPoints ?? '',
    eligibility: extra.eligibility ?? '',
    examinationPattern: extra.examinationPattern ?? '',
    alumniStatus: extra.alumniStatus ?? '',
    placementAssistance: extra.placementAssistance ?? '',
    industryReadyCurriculum: extra.industryReadyCurriculum ?? '',
    studentRating: extra.studentRating ?? '',
    satisfiedStudents: extra.satisfiedStudents ?? '',
    studentChoice: extra.studentChoice ?? '',
    studentsVisited: extra.studentsVisited ?? '',
  };
}

export default function ComparePage({ universities }: { universities: University[] }) {
  const cols = universities.map((u) => ({ uni: u, fields: fieldsFor(u) }));

  return (
    <>
      {/* The compare page ships its own stylesheet on the reference. */}
      <link rel="stylesheet" href="/assets/css/compare-page.css" />

      <div className="rbt-breadcrumb-default ptb--30 ptb_md--30 ptb_sm--20 bg-gradient-1">
        <div className="container">
          <div className="row">
            <div className="col-lg-12">
              <div className="breadcrumb-inner text-center">
                <h4 className="title">Compare Result</h4>
                <ul className="page-list">
                  <li className="rbt-breadcrumb-item">
                    <a href="/">Home</a>
                  </li>{' '}
                  <li>
                    <div className="icon-right">
                      <i className="feather-chevron-right"></i>
                    </div>
                  </li>{' '}
                  <li className="rbt-breadcrumb-item active">Compare Result</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="py-4" id="set-modal">
        <div className="container">
          <div className="container bg-transparent">
            <div className="table-responsive">
              <table className="table table-bordered compare-table align-middle">
                <thead>
                  <tr>
                    <th className="align-middle">
                      <div className="compare-result-title text-center">
                        Compare
                        <br />
                        Result
                      </div>
                    </th>
                    {cols.map(({ uni }) => (
                      <th key={uni.slug}>
                        <div className="compare-header-card">
                          <div className="logo-wrap">
                            <img src={uni.logo} alt={uni.name} />
                          </div>
                          <h5 className="uni-name">{uni.name}</h5>
                          <button
                            type="button"
                            className="btn btn-enquire-now mt-2"
                            data-bs-toggle="modal"
                            data-bs-target="#pop"
                          >
                            <i className="feather-edit me-1"></i> Enquiry Now
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map(({ label, key }) => (
                    <tr key={key}>
                      <th>{label}</th>
                      {cols.map(({ uni, fields }) => (
                        <td key={uni.slug} className="text-center">
                          {fields[key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
