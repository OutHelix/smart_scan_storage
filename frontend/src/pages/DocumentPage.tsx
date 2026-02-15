import { Link, useParams } from 'react-router-dom'

export function DocumentPage() {
  const { id } = useParams()
  return (
    <div className="wf">
      <div className="wf-row">
        <Link to="/">← Back</Link>
        <span>Document {id}</span>
      </div>
      <div className="wf-doc">
        <aside className="wf-thumbs">
          <div className="wf-thumb">1</div>
          <div className="wf-thumb wf-thumb--active">2</div>
          <div className="wf-thumb">3</div>
          <div className="wf-thumb">4</div>
          <p>Page 2 of 4</p>
          <button type="button" className="wf-btn">Prev</button>
          <button type="button" className="wf-btn">Next</button>
        </aside>
        <div className="wf-doc-main">
          <div className="wf-page">Page image</div>
          <div className="wf-block">
            OCR text: &quot;Document content...&quot;
            <br />
            <button type="button" className="wf-btn">Copy</button>
            <button type="button" className="wf-btn">Export</button>
          </div>
        </div>
      </div>
    </div>
  )
}
