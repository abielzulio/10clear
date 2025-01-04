import React from "react"
import "./index.css"
import { pdfjs, Document, Page } from "react-pdf"

pdfjs.GlobalWorkerOptions.workerSrc = `https://registry.npmmirror.com/pdfjs-dist/${pdfjs.version}/files/build/pdf.worker.min.mjs`

function App() {
  const [pdf, setPdf] = React.useState<File | null>(null)
  const [scale, setScale] = React.useState(1.0)
  const [metadata, setMetadata] = React.useState<{
    totalPages: number
    currentPage: number
    height: number
    width: number
  }>({
    totalPages: 0,
    currentPage: 1,
    height: 0,
    width: 0,
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPdf(e.target.files[0])
    }
  }

  const handleZoomIn = () => {
    setScale((prevScale) => Math.min(prevScale + 0.1, 2.0))
  }

  const handleZoomOut = () => {
    setScale((prevScale) => Math.max(prevScale - 0.1, 0.5))
  }

  const handlePrevPage = () => {
    setMetadata((prev) => ({
      ...prev,
      currentPage: Math.max(prev.currentPage - 1, 1),
    }))
  }

  const handleNextPage = () => {
    setMetadata((prev) => ({
      ...prev,
      currentPage: Math.min(prev.currentPage + 1, prev.totalPages),
    }))
  }

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="container p-4 mx-auto">
        {/* Header with file input */}
        <div className="p-4 mb-4 bg-white rounded-lg shadow">
          <input
            type="file"
            onChange={handleFileChange}
            accept=".pdf"
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        {pdf && (
          <>
            {/* Controls */}
            <div className="flex items-center justify-between p-4 mb-4 bg-white rounded-lg shadow">
              <div className="flex items-center space-x-4">
                <button
                  onClick={handlePrevPage}
                  disabled={metadata.currentPage <= 1}
                  className="px-4 py-2 text-white bg-blue-500 rounded-lg disabled:bg-gray-300"
                >
                  Previous
                </button>
                <span className="text-gray-700">
                  Page {metadata.currentPage} of {metadata.totalPages}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={metadata.currentPage >= metadata.totalPages}
                  className="px-4 py-2 text-white bg-blue-500 rounded-lg disabled:bg-gray-300"
                >
                  Next
                </button>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleZoomOut}
                  className="px-4 py-2 text-white bg-blue-500 rounded-lg"
                >
                  Zoom Out
                </button>
                <span className="text-gray-700">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  onClick={handleZoomIn}
                  className="px-4 py-2 text-white bg-blue-500 rounded-lg"
                >
                  Zoom In
                </button>
              </div>
            </div>

            {/* PDF Viewer */}
            <div className="p-4 bg-white rounded-lg shadow">
              <div className="flex justify-center">
                <Document
                  file={pdf}
                  onLoadSuccess={(props) =>
                    setMetadata((prev) => ({
                      ...prev,
                      totalPages: props.numPages,
                    }))
                  }
                  className="max-w-full"
                >
                  <Page
                    onLoadSuccess={(props) =>
                      setMetadata((prev) => ({
                        ...prev,
                        height: props.height,
                        width: props.width,
                      }))
                    }
                    pageNumber={metadata.currentPage}
                    scale={scale}
                    className="max-w-full [&>canvas]:max-w-full [&>canvas]:h-auto"
                    renderTextLayer={false}
                  />
                </Document>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

export default App
