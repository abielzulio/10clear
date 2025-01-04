import React from "react"
import "./index.css"
import { pdfjs, Document, Page } from "react-pdf"
import { TextItem } from "pdfjs-dist/types/src/display/api"
import type { PDFDocumentProxy } from "pdfjs-dist"
import lunr from "lunr"
import type { Children, Root } from "./schema"
import pdfWorkerSource from "pdfjs-dist/build/pdf.worker.min.mjs"

pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(
  new Blob([pdfWorkerSource], { type: "text/javascript" })
)

type Highlight = {
  left: number
  top: number
  width: number
  height: number
}

type SearchableItem = {
  pageIndex: number
  item: TextItem
  text: string
  id: string
}

type BBoxHighlight = {
  id: string
  page: number
  bbox: number[] // [left, bottom, right, top]
  value: string
}

function App() {
  const [pdf, setPdf] = React.useState<File | null>(null)
  const [scale, setScale] = React.useState(1.3)
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

  const [highlights, setHighlights] = React.useState<
    Record<number, Highlight[]>
  >({})
  const pdfDocumentRef = React.useRef<PDFDocumentProxy | null>(null)
  const searchIndexRef = React.useRef<lunr.Index | null>(null)
  const searchItemsRef = React.useRef<SearchableItem[]>([])
  const [bboxHighlights, setBboxHighlights] = React.useState<BBoxHighlight[]>(
    []
  )
  const [selectedHighlight, setSelectedHighlight] =
    React.useState<BBoxHighlight | null>(null)
  const [jsonInput, setJsonInput] = React.useState("")
  const [jsonHighlightSearch, setJsonHighlightSearch] = React.useState("")

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (e.target.files) {
        setPdf(e.target.files[0])
        const doc = await pdfjs.getDocument(
          URL.createObjectURL(e.target.files[0])
        ).promise
        pdfDocumentRef.current = doc
        await buildSearchIndex(doc)
      }
    } catch (error) {
      console.error("Error loading PDF:", error)
    }
  }

  const calculateHighlights = React.useCallback(
    (
      matches: TextItem[],
      viewport: { height: number; width: number },
      searchText: string
    ): Highlight[] => {
      const highlights: Highlight[] = []
      const regex = new RegExp(`\\b${searchText}\\b`, "i")

      matches.forEach((match) => {
        const transform = match.transform || [1, 0, 0, 1, 0, 0]
        const text = match.str
        const match_result = text.match(regex)

        if (match_result) {
          const start = match_result.index || 0
          const charWidth = (match.width || 0) / text.length
          highlights.push({
            left: transform[4] + start * charWidth,
            top: viewport.height - transform[5] - 10,
            width: searchText.length * charWidth,
            height: match.height || 0,
          })
        }
      })
      return highlights
    },
    []
  )

  const memoizedSearchResults = React.useMemo(() => {
    if (!searchIndexRef.current || !searchText || !searchItemsRef.current)
      return []

    try {
      const results = searchIndexRef.current.search(searchText)

      return results
        .reduce(
          (
            acc: Array<{ pageIndex: number; matches: Array<TextItem> }>,
            result: lunr.Index.Result
          ) => {
            const item = searchItemsRef.current.find(
              (searchItem) => searchItem.id === result.ref
            )
            if (!item) return acc

            const pageGroup = acc.find((g) => g.pageIndex === item.pageIndex)
            if (pageGroup) {
              pageGroup.matches.push(item.item)
            } else {
              acc.push({ pageIndex: item.pageIndex, matches: [item.item] })
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
      setHighlights({})
      return
    }

    setSearchResults(memoizedSearchResults)

    const calculateAllHighlights = async () => {
      if (!pdfDocumentRef.current) return

      const allHighlights: Record<number, Highlight[]> = {}

      for (const result of memoizedSearchResults) {
        const page = await pdfDocumentRef.current.getPage(result.pageIndex)
        const viewport = page.getViewport({ scale: 1.0 })
        allHighlights[result.pageIndex] = calculateHighlights(
          result.matches,
          viewport,
          searchText
        )
      }

      setHighlights(allHighlights)
    }

    calculateAllHighlights()
  }, [searchText, memoizedSearchResults, calculateHighlights])

  const goToSearchResult = (pageIndex: number) => {
    // Find the page element
    const pageElement = document.querySelector(
      `[data-page-number="${pageIndex}"]`
    )
    if (pageElement) {
      // Scroll the page into view with smooth animation
      pageElement.scrollIntoView({ behavior: "smooth", block: "start" })
    }

    // Update metadata (optional, since we're showing all pages)
    setMetadata((prev) => ({
      ...prev,
      currentPage: pageIndex,
    }))
  }

  const buildSearchIndex = async (doc: PDFDocumentProxy) => {
    const searchableItems: SearchableItem[] = []

    for (let pageIndex = 1; pageIndex <= doc.numPages; pageIndex++) {
      const page = await doc.getPage(pageIndex)
      const textContent = await page.getTextContent()

      const textItems = textContent.items.filter(
        (item): item is TextItem => "str" in item
      )

      textItems.forEach((item, idx) => {
        searchableItems.push({
          pageIndex,
          item,
          text: item.str,
          id: `${pageIndex}-${idx}`,
        })
      })
    }

    searchItemsRef.current = searchableItems
    searchIndexRef.current = lunr(function () {
      this.ref("id")
      this.field("text")

      searchableItems.forEach((item) => {
        this.add(item)
      })
    })
  }

  const parseJsonToHighlights = async (
    nodes: Children[]
  ): Promise<BBoxHighlight[]> => {
    const highlights: BBoxHighlight[] = []

    if (!pdfDocumentRef.current) return highlights

    const traverse = async (node: Children) => {
      if (node.bbox && node.value && node.page) {
        const page = await pdfDocumentRef.current!.getPage(node.page)
        const viewport = page.getViewport({ scale: 1.0 })

        // PDF coordinates start from bottom-left, we need to convert to top-left
        const [x1, y1, x2, y2] = node.bbox
        highlights.push({
          id: node.id,
          page: node.page,
          bbox: [
            x1, // left
            viewport.height - y2, // top (convert from bottom)
            x2, // right
            viewport.height - y1, // bottom (convert from top)
          ],
          value: node.value,
        })
      }

      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          await traverse(child)
        }
      }
    }

    for (const node of nodes) {
      await traverse(node)
    }
    return highlights
  }

  const handleJsonData = async (jsonData: Root) => {
    const highlights = await parseJsonToHighlights(jsonData.result)
    setBboxHighlights(highlights)
  }

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="p-4 mx-auto">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-4">
            {pdf ? (
              <>
                {/* PDF Viewer - modify to show all pages */}
                <div className="p-4 bg-white rounded-lg shadow overflow-y-auto max-h-[90vh]">
                  <div className="relative flex flex-col items-center">
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
                      {Array.from(
                        new Array(metadata.totalPages),
                        (_, index) => (
                          <div
                            key={index + 1}
                            className="relative mb-4"
                            data-page-number={index + 1}
                          >
                            <Page
                              pageNumber={index + 1}
                              scale={scale}
                              className="max-w-full [&>canvas]:max-w-full [&>canvas]:h-auto"
                              renderTextLayer={true}
                            />
                            {/* Highlight overlays */}
                            {highlights[index + 1]?.map((highlight, hIndex) => (
                              <div
                                key={hIndex}
                                className="absolute bg-yellow-200 opacity-50 pointer-events-none"
                                style={{
                                  left: highlight.left * scale,
                                  top: highlight.top * scale,
                                  width: highlight.width * scale,
                                  height: highlight.height * scale,
                                }}
                              />
                            ))}
                            {/* BBox highlights */}
                            {bboxHighlights
                              .filter(
                                (highlight) => highlight.page === index + 1
                              )
                              .map((highlight) => (
                                <div
                                  key={highlight.id}
                                  className={`absolute pointer-events-none ${
                                    selectedHighlight?.id === highlight.id
                                      ? "bg-blue-500/40"
                                      : "bg-blue-500/10"
                                  }`}
                                  style={{
                                    left: highlight.bbox[0] * scale,
                                    top: highlight.bbox[1] * scale,
                                    width:
                                      (highlight.bbox[2] - highlight.bbox[0]) *
                                      scale,
                                    height:
                                      (highlight.bbox[3] - highlight.bbox[1]) *
                                      scale,
                                  }}
                                />
                              ))}
                          </div>
                        )
                      )}
                    </Document>
                  </div>
                </div>

                <div className="p-4 mb-4 bg-white rounded-lg shadow">
                  <input
                    type="file"
                    onChange={handleFileChange}
                    accept=".pdf"
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>
              </>
            ) : (
              <div className="p-4 mb-4 bg-white rounded-lg shadow">
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf"
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {/* Search Controls */}
            <div className="flex flex-col gap-4 p-4 bg-white rounded-lg shadow">
              <div className="flex items-center gap-4">
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search in PDF..."
                  className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                />
                <button
                  onClick={handleSearch}
                  className="px-4 py-2 text-white bg-black rounded-lg"
                >
                  Search
                </button>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div>
                  <div className="overflow-auto max-h-40">
                    {searchResults.map((result, idx) => (
                      <button
                        key={idx}
                        onClick={() => goToSearchResult(result.pageIndex)}
                        className="flex items-center justify-between w-full px-4 py-2 text-left rounded hover:bg-gray-100"
                      >
                        {result.matches[0].str}
                        <span className="text-sm opacity-50">
                          Page {result.pageIndex}{" "}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Add this after the search controls section and before the PDF controls */}
            <div className="flex flex-col gap-4 p-4 mt-4 bg-white rounded-lg shadow">
              <h3 className="mb-2 text-lg font-semibold">Highlights</h3>
              {bboxHighlights.length > 0 && (
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={jsonHighlightSearch}
                    onChange={(e) => setJsonHighlightSearch(e.target.value)}
                    placeholder="Search highlights..."
                    className="w-full px-4 py-2 mb-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                  />
                  <div className="overflow-auto max-h-[45vh] flex flex-col gap-3">
                    {bboxHighlights
                      .sort((a, b) => a.page - b.page)
                      .filter((highlight) =>
                        highlight.value
                          .toLowerCase()
                          .includes(jsonHighlightSearch.toLowerCase())
                      )
                      .map((highlight, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            const pageElement = document.querySelector(
                              `[data-page-number="${highlight.page}"]`
                            )
                            if (pageElement) {
                              // Scroll the page into view with smooth animation
                              pageElement.scrollIntoView({
                                behavior: "smooth",
                                block: "start",
                              })
                            }
                            setSelectedHighlight(highlight)
                            setMetadata((prev) => ({
                              ...prev,
                              currentPage: highlight.page,
                            }))
                          }}
                          className={`flex flex-col w-full gap-1 px-3 py-2 text-left bg-white border rounded shadow hover:opacity-80 border-1 border-zinc-200 ${
                            selectedHighlight?.id === highlight.id
                              ? "bg-zinc-200/50"
                              : ""
                          }`}
                        >
                          <span className="font-medium">{highlight.value}</span>
                          <span className="text-sm opacity-50">
                            Page {highlight.page}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <h3 className="mb-2 font-semibold">API Response</h3>
                <div className="flex flex-col items-center gap-4">
                  <textarea
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    placeholder="Paste JSON here..."
                    className="flex-1 p-2 border rounded-lg min-h-[100px] w-full"
                  />
                  <button
                    onClick={async () => {
                      try {
                        const jsonData = JSON.parse(jsonInput) as Root
                        await handleJsonData(jsonData)
                      } catch (error) {
                        console.error("Invalid JSON:", error)
                      }
                    }}
                    className="w-full px-4 py-2 text-white transition duration-200 ease-in-out bg-black rounded-lg hover:bg-zinc-700"
                  >
                    Parse API Response
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

export default App
