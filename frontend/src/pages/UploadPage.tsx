import { Link } from 'react-router-dom'

export function UploadPage() {
  return (
    <div className="wf">
      <div className="wf-label">Upload documents</div>
      <div className="wf-dropzone">
        Drag files here or click to select. PDF, JPG, PNG.
      </div>
      <div className="wf-label">Queue: file1.pdf [====] 60% · file2.jpg [======] 100%</div>
      <button type="button" className="wf-btn">Start upload</button>
      <p><Link to="/">← Back</Link></p>
    </div>
  )
}
