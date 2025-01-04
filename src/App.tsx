import React from "react"
import "./index.css"
import { pdfjs, Document, Page } from "react-pdf"
import type { PDFDocumentProxy } from "pdfjs-dist"
import lunr from "lunr"

pdfjs.GlobalWorkerOptions.workerSrc = `https://registry.npmmirror.com/pdfjs-dist/${pdfjs.version}/files/build/pdf.worker.min.mjs`

type BoundingBox = {
  x: number
  y: number
  width: number
  height: number
}

type APIElement = {
  id: string
  type: string
  level: number
  page: number
  value: string
  boundingBox?: BoundingBox
  children?: APIElement[]
}

type APIResponse = {
  message: string
  revised: boolean
  metadata: {
    title: string
    markdown: string
  }
  result: APIElement[]
}

type Highlight = {
  left: number
  top: number
  width: number
  height: number
  pageIndex: number
}

type SearchableItem = {
  id: string
  text: string
  pageIndex: number
  boundingBox?: BoundingBox
}

function App() {
  const [pdf, setPdf] = React.useState<File | null>(null)
  const [scale, setScale] = React.useState(1.0)
  const [searchText, setSearchText] = React.useState("")
  const [apiData, setApiData] = React.useState<APIResponse | null>(null)
  const [searchResults, setSearchResults] = React.useState<
    Array<{
      pageIndex: number
      matches: Array<SearchableItem>
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

  const [highlights, setHighlights] = React.useState<Highlight[]>([])
  const pdfDocumentRef = React.useRef<PDFDocumentProxy | null>(null)
  const searchIndexRef = React.useRef<lunr.Index | null>(null)
  const searchItemsRef = React.useRef<SearchableItem[]>([])
  const [apiInput, setApiInput] = React.useState("")
  const [boundingElements, setBoundingElements] = React.useState<
    SearchableItem[]
  >([])
  const [elementFilter, setElementFilter] = React.useState("")
  const [sortOrder, setSortOrder] = React.useState<"page" | "text">("page")

  // Function to recursively process API elements
  const processAPIElements = (elements: APIElement[]): SearchableItem[] => {
    const items: SearchableItem[] = []

    const processElement = (element: APIElement) => {
      // Add debug logging
      console.log("Processing element:", element)

      // Check if element has a value and is not empty
      if (element.value && element.value.trim()) {
        items.push({
          id: element.id,
          text: element.value,
          pageIndex: element.page,
          boundingBox: element.boundingBox || undefined,
        })
      }

      if (element.children && element.children.length > 0) {
        element.children.forEach(processElement)
      }
    }

    elements.forEach(processElement)
    console.log("Processed items:", items) // Debug log
    return items
  }

  // Update buildSearchIndex to use API data
  const buildSearchIndex = React.useCallback((apiResponse: APIResponse) => {
    const searchableItems = processAPIElements(apiResponse.result)

    searchItemsRef.current = searchableItems
    searchIndexRef.current = lunr(function () {
      this.ref("id")
      this.field("text")

      searchableItems.forEach((item) => {
        this.add({
          id: item.id,
          text: item.text,
        })
      })
    })
  }, [])

  const calculateHighlights = React.useCallback(
    (matches: SearchableItem[]): Highlight[] => {
      return matches
        .filter((match) => match.boundingBox)
        .map((match) => ({
          left: match.boundingBox!.x,
          top: match.boundingBox!.y,
          width: match.boundingBox!.width,
          height: match.boundingBox!.height,
          pageIndex: match.pageIndex,
        }))
    },
    []
  )

  const updateHighlightsForPage = React.useCallback(
    (pageIndex: number) => {
      const pageResults = searchResults.find((r) => r.pageIndex === pageIndex)
      if (pageResults) {
        setHighlights(calculateHighlights(pageResults.matches))
      } else {
        setHighlights([])
      }
    },
    [searchResults, calculateHighlights]
  )

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (e.target.files) {
        setPdf(e.target.files[0])
        const doc = await pdfjs.getDocument(
          URL.createObjectURL(e.target.files[0])
        ).promise
        pdfDocumentRef.current = doc
        setMetadata((prev) => ({
          ...prev,
          totalPages: doc.numPages,
        }))
      }
    } catch (error) {
      console.error("Error loading PDF:", error)
    }
  }

  const handleZoomIn = React.useCallback(() => {
    setScale((prevScale) => Math.min(prevScale + 0.1, 2.0))
  }, [])

  const handleZoomOut = React.useCallback(() => {
    setScale((prevScale) => Math.max(prevScale - 0.1, 0.5))
  }, [])

  const handlePrevPage = React.useCallback(() => {
    setMetadata((prev) => ({
      ...prev,
      currentPage: Math.max(prev.currentPage - 1, 1),
    }))
  }, [])

  const handleNextPage = React.useCallback(() => {
    setMetadata((prev) => ({
      ...prev,
      currentPage: Math.min(prev.currentPage + 1, prev.totalPages),
    }))
  }, [])

  React.useEffect(() => {
    updateHighlightsForPage(metadata.currentPage)
  }, [metadata.currentPage, updateHighlightsForPage])

  const memoizedSearchResults = React.useMemo(() => {
    if (!searchIndexRef.current || !searchText || !searchItemsRef.current)
      return []

    try {
      const results = searchIndexRef.current.search(searchText)

      return results
        .reduce(
          (
            acc: Array<{ pageIndex: number; matches: Array<SearchableItem> }>,
            result: lunr.Index.Result
          ) => {
            const item = searchItemsRef.current.find(
              (searchItem) => searchItem.id === result.ref
            )
            if (!item) return acc

            const pageGroup = acc.find((g) => g.pageIndex === item.pageIndex)
            if (pageGroup) {
              pageGroup.matches.push(item)
            } else {
              acc.push({ pageIndex: item.pageIndex, matches: [item] })
            }
            return acc
          },
          []
        )
        .sort((a, b) => a.pageIndex - b.pageIndex)
    } catch (error) {
      console.error("Search error:", error)
      return []
    }
  }, [searchText])

  const handleSearch = React.useCallback(() => {
    if (!searchText) {
      setSearchResults([])
      setHighlights([])
      return
    }

    setSearchResults(memoizedSearchResults)
    updateHighlightsForPage(metadata.currentPage)
  }, [
    searchText,
    metadata.currentPage,
    memoizedSearchResults,
    updateHighlightsForPage,
  ])

  const goToSearchResult = (pageIndex: number) => {
    setMetadata((prev) => ({
      ...prev,
      currentPage: pageIndex,
    }))
  }

  const handleProcessAPI = () => {
    try {
      const data = JSON.parse(apiInput)
      console.log("Parsed API data:", data) // Debug log

      if (!data.result || !Array.isArray(data.result)) {
        console.error(
          "Invalid API response format: missing or invalid result array"
        )
        alert("Invalid API response format")
        return
      }

      setApiData(data)
      const elements = processAPIElements(data.result)
      console.log("Found elements:", elements) // Debug log
      setBoundingElements(elements)
      buildSearchIndex(data)
    } catch (error) {
      console.error("Error processing API response:", error)
      alert("Error processing API response: " + (error as Error).message)
    }
  }

  const goToElement = (element: SearchableItem) => {
    console.log("Going to element:", element) // Debug log

    // Ensure we have a valid page number
    if (typeof element.pageIndex !== "number" || element.pageIndex < 0) {
      console.error("Invalid page index:", element.pageIndex)
      return
    }

    // Convert to 1-based page number for display
    const pageNumber = element.pageIndex + 1

    // Validate against total pages
    if (pageNumber > metadata.totalPages) {
      console.error(
        `Page ${pageNumber} exceeds total pages ${metadata.totalPages}`
      )
      return
    }

    setMetadata((prev) => ({
      ...prev,
      currentPage: pageNumber,
    }))

    if (element.boundingBox) {
      setHighlights([
        {
          left: element.boundingBox.x,
          top: element.boundingBox.y,
          width: element.boundingBox.width,
          height: element.boundingBox.height,
          pageIndex: element.pageIndex,
        },
      ])
    }
  }

  // Add filtered and sorted elements
  const filteredElements = React.useMemo(() => {
    return boundingElements
      .filter(
        (element) =>
          element.text.toLowerCase().includes(elementFilter.toLowerCase()) ||
          (element.pageIndex + 1).toString().includes(elementFilter)
      )
      .sort((a, b) => {
        if (sortOrder === "page") {
          return a.pageIndex - b.pageIndex
        }
        return a.text.localeCompare(b.text)
      })
  }, [boundingElements, elementFilter, sortOrder])

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="container p-4 mx-auto">
        {/* Header with file input and API input */}
        <div className="p-4 mb-4 bg-white rounded-lg shadow">
          <input
            type="file"
            onChange={handleFileChange}
            accept=".pdf"
            className="block w-full mb-4 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              API Response (JSON)
            </label>
            <textarea
              value={apiInput}
              onChange={(e) => setApiInput(e.target.value)}
              placeholder="Paste your API response here..."
              className="w-full h-48 p-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleProcessAPI}
              disabled={!pdf || !apiInput.trim()}
              className="px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Process API Response
            </button>
          </div>
          {apiData && (
            <div className="mt-2 text-sm text-gray-600">
              Loaded API data: {apiData.metadata.title}
            </div>
          )}
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
                  placeholder="Search in document..."
                  className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSearch}
                  className="px-4 py-2 text-white bg-blue-500 rounded-lg hover:bg-blue-600"
                >
                  Search
                </button>
              </div>

              {/* Search Results with Bounding Box Info */}
              {searchResults.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h3 className="font-semibold">Search Results:</h3>
                  <div className="overflow-auto max-h-40">
                    {searchResults.map((result, idx) => (
                      <div key={idx} className="py-2 border-b border-gray-200">
                        <button
                          onClick={() => goToSearchResult(result.pageIndex)}
                          className="block w-full px-4 py-2 text-left rounded hover:bg-gray-100"
                        >
                          <div className="font-medium">
                            Page {result.pageIndex + 1}
                          </div>
                          {result.matches.map((match, matchIdx) => (
                            <div
                              key={matchIdx}
                              className="mt-1 text-sm text-gray-600"
                            >
                              {match.text}
                              {match.boundingBox && (
                                <span className="ml-2 text-xs text-gray-500">
                                  (at {Math.round(match.boundingBox.x)},{" "}
                                  {Math.round(match.boundingBox.y)})
                                </span>
                              )}
                            </div>
                          ))}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bounding Elements List */}
            {boundingElements.length > 0 && (
              <div className="p-4 mb-4 bg-white rounded-lg shadow">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">
                    Elements with Bounding Boxes ({boundingElements.length})
                  </h3>
                  <div className="flex items-center gap-4">
                    <input
                      type="text"
                      value={elementFilter}
                      onChange={(e) => setElementFilter(e.target.value)}
                      placeholder="Filter elements..."
                      className="px-3 py-1 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={sortOrder}
                      onChange={(e) =>
                        setSortOrder(e.target.value as "page" | "text")
                      }
                      className="px-3 py-1 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="page">Sort by Page</option>
                      <option value="text">Sort by Text</option>
                    </select>
                  </div>
                </div>
                <div className="overflow-auto max-h-96">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-sm font-medium text-left text-gray-500">
                          Page
                        </th>
                        <th className="px-4 py-2 text-sm font-medium text-left text-gray-500">
                          Text
                        </th>
                        <th className="px-4 py-2 text-sm font-medium text-left text-gray-500">
                          Position
                        </th>
                        <th className="px-4 py-2 text-sm font-medium text-left text-gray-500">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredElements.map((element) => (
                        <tr key={element.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {element.pageIndex + 1}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {element.text.length > 50
                              ? `${element.text.substring(0, 50)}...`
                              : element.text}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-500">
                            {element.boundingBox &&
                              `(${Math.round(
                                element.boundingBox.x
                              )}, ${Math.round(element.boundingBox.y)})`}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <button
                              onClick={() => goToElement(element)}
                              className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              Go to
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

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
