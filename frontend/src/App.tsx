import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { UploadPage } from './pages/UploadPage'
import { DocumentPage } from './pages/DocumentPage'
import { StitchPage } from './pages/StitchPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="upload" element={<UploadPage />} />
          <Route path="doc/:id" element={<DocumentPage />} />
          <Route path="stitch" element={<StitchPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
