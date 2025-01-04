import React from "react"
import "./index.css"
import { pdfjs, Document, Page } from "react-pdf"
import { TextItem } from "pdfjs-dist/types/src/display/api"
import type { PDFDocumentProxy } from "pdfjs-dist"

pdfjs.GlobalWorkerOptions.workerSrc = `https://registry.npmmirror.com/pdfjs-dist/${pdfjs.version}/files/build/pdf.worker.min.mjs`

// Add this type for highlight positions
type Highlight = {
  left: number
  top: number
  width: number
  height: number
}

function App() {
  const [pdf, setPdf] = React.useState<File | null>(null)
  const [scale, setScale] = React.useState(1.0)
  const [searchText, setSearchText] = React.useState("")
  const [searchResults, setSearchResults] = React.useState<
    Array<{
      pageIndex: number
      matches: Array<TextItem>
    }>
  >([])
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
  // Add state for highlights
  const [highlights, setHighlights] = React.useState<Highlight[]>([])
  const pdfDocumentRef = React.useRef<PDFDocumentProxy | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPdf(e.target.files[0])
      pdfDocumentRef.current = null // Reset the ref when new file is selected
    }
  }

  const handleZoomIn = () => {
    setScale((prevScale) => Math.min(prevScale + 0.1, 2.0))
  }

  const handleZoomOut = () => {
    setScale((prevScale) => Math.max(prevScale - 0.1, 0.5))
  }

  const handlePrevPage = async () => {
    setMetadata((prev) => ({
      ...prev,
      currentPage: Math.max(prev.currentPage - 1, 1),
    }))
    await updateHighlightsForPage(Math.max(metadata.currentPage - 1, 1))
  }

  const handleNextPage = async () => {
    setMetadata((prev) => {
      const newPage = Math.min(prev.currentPage + 1, prev.totalPages)
      updateHighlightsForPage(newPage)
      return {
        ...prev,
        currentPage: newPage,
      }
    })
  }

  const handleSearch = async () => {
    if (!pdf || !searchText) {
      setSearchResults([])
      setHighlights([])
      return
    }

    const doc = await pdfjs.getDocument(URL.createObjectURL(pdf)).promise
    pdfDocumentRef.current = doc // Update ref instead of state
    const results: typeof searchResults = []

    for (let pageIndex = 1; pageIndex <= doc.numPages; pageIndex++) {
      const page = await doc.getPage(pageIndex)
      const textContent = await page.getTextContent()
      const viewport = page.getViewport({ scale: 1.0 })

      const textItems = textContent.items.filter(
        (item): item is TextItem => "str" in item
      )

      const pageText = textItems
        .map((item) => item.str)
        .join(" ")
        .toLowerCase()

      if (pageText.includes(searchText.toLowerCase())) {
        const matches = textItems.filter((item) =>
          item.str.toLowerCase().includes(searchText.toLowerCase())
        )
        results.push({ pageIndex, matches })

        // Update highlights when viewing matching page
        if (pageIndex === metadata.currentPage) {
          setHighlights(
            matches.map((match) => {
              const transform = match.transform || [1, 0, 0, 1, 0, 0]
              return {
                left: transform[4],
                top: viewport.height - transform[5] - 10,
                width: match.width || 0,
                height: match.height || 0,
              }
            })
          )
        }
      }
    }

    setSearchResults(results)
  }

  const goToSearchResult = async (pageIndex: number) => {
    setMetadata((prev) => ({
      ...prev,
      currentPage: pageIndex,
    }))

    if (!pdfDocumentRef.current) return

    const pageResults = searchResults.find((r) => r.pageIndex === pageIndex)
    if (pageResults) {
      const page = await pdfDocumentRef.current.getPage(pageIndex)
      const viewport = page.getViewport({ scale: 1.0 })
      setHighlights(
        pageResults.matches.map((match) => {
          const transform = match.transform || [1, 0, 0, 1, 0, 0]
          return {
            left: transform[4],
            top: viewport.height - transform[5] - 10,
            width: match.width || 0,
            height: match.height || 0,
          }
        })
      )
    }
  }

  // New helper function to update highlights for a specific page
  const updateHighlightsForPage = async (pageIndex: number) => {
    if (!pdfDocumentRef.current) return

    const pageResults = searchResults.find((r) => r.pageIndex === pageIndex)
    if (pageResults) {
      const page = await pdfDocumentRef.current.getPage(pageIndex)
      const viewport = page.getViewport({ scale: 1.0 })
      setHighlights(
        pageResults.matches.map((match) => {
          const transform = match.transform || [1, 0, 0, 1, 0, 0]
          return {
            left: transform[4],
            top: viewport.height - transform[5] - 10,
            width: match.width || 0,
            height: match.height || 0,
          }
        })
      )
    } else {
      setHighlights([]) // Clear highlights if no results on this page
    }
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
            {/* Search Controls */}
            <div className="p-4 mb-4 bg-white rounded-lg shadow">
              <div className="flex items-center gap-4">
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search in PDF..."
                  className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <button
                  onClick={handleSearch}
                  className="px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600"
                >
                  Search
                </button>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h3 className="font-semibold">Search Results:</h3>
                  <div className="overflow-auto max-h-40">
                    {searchResults.map((result, idx) => (
                      <button
                        key={idx}
                        onClick={() => goToSearchResult(result.pageIndex)}
                        className="block w-full px-4 py-2 text-left rounded hover:bg-gray-100"
                      >
                        Page {result.pageIndex}: {result.matches.length} matches
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

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
              <div className="relative flex justify-center">
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
                    renderTextLayer={true}
                  />
                  {/* Highlight overlays */}
                  {highlights.map((highlight, index) => (
                    <div
                      key={index}
                      className="absolute bg-yellow-200 opacity-50 pointer-events-none"
                      style={{
                        left: highlight.left * scale,
                        top: highlight.top * scale,
                        width: highlight.width * scale,
                        height: highlight.height * scale,
                      }}
                    />
                  ))}
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
