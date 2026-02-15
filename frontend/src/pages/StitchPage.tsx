import { Link } from 'react-router-dom'

export function StitchPage() {
  return (
    <div className="wf">
      <div className="wf-label">Stitch pages</div>
      <div className="wf-block">
        Select pages or files (order = stitch order):
        <ul className="wf-list">
          <li><label><input type="checkbox" /> Page 1 (scan_001.jpg)</label></li>
          <li><label><input type="checkbox" /> Page 2 (scan_002.jpg)</label></li>
          <li><label><input type="checkbox" /> part_a.pdf</label></li>
        </ul>
        <button type="button" className="wf-btn">Add files...</button>
      </div>
      <div className="wf-label">Order preview: [1] [2] [3] <button type="button" className="wf-btn">Change order</button></div>
      <div className="wf-preview">Stitched document preview</div>
      <button type="button" className="wf-btn">Stitch and save</button>
      <p><Link to="/">← Back</Link></p>
    </div>
  )
}
