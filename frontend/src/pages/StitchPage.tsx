import { Link } from 'react-router-dom'

export function StitchPage() {
  return (
    <div className="page">
      <h1 className="page-title">Stitch pages</h1>
      <div className="card">
        <p className="card-text">Select pages or files in the order you want — they will be merged into one document.</p>
        <p className="page-muted">Coming soon. For now you can upload and view documents on the home page.</p>
        <Link to="/" className="btn btn--primary">View documents</Link>
      </div>
    </div>
  )
}
