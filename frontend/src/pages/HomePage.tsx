import { Link } from 'react-router-dom'

export function HomePage() {
  return (
    <div className="wf">
      <div className="wf-row">
        <input type="search" className="wf-input" placeholder="Search..." readOnly />
        <Link to="/upload" className="wf-btn">Upload</Link>
      </div>
      <div className="wf-row wf-filters">
        <span>Name</span>
        <span>Date from — to</span>
        <span>Amount from — to</span>
        <button type="button" className="wf-btn">Apply</button>
      </div>
      <div className="wf-label">Documents</div>
      <div className="wf-grid">
        {[1, 2, 3, 4].map((i) => (
          <Link to={`/doc/${i}`} key={i} className="wf-card">
            <div className="wf-card-preview">preview</div>
            <div className="wf-card-title">Document title</div>
            <div className="wf-card-meta">12.02.2025</div>
          </Link>
        ))}
      </div>
      <div className="wf-label">Sort: by date</div>
    </div>
  )
}
