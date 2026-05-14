# Implementation Plan: Excel Stock Import Analytics

## Overview

This implementation plan converts the Excel Stock Import Analytics feature into discrete coding tasks. The feature adds stock report detection, parsing, analytics computation, and a dashboard UI to the existing bulk import system. Frontend is TypeScript/React with client-side Excel parsing; backend is Rust with a new catalog matching endpoint.

## Tasks

- [x] 1. Set up project structure and core interfaces
  - [x] 1.1 Create stock report utility modules and type definitions
    - Create `frontend/src/utils/stockReport/types.ts` with all TypeScript interfaces: `DetectionResult`, `ColumnMapping`, `MappedRow`, `ParsedStockRow`, `StockParseResult`, `StockHealthCategory`, `StockAnalytics`, `RestockItem`, `PriceAnalytics`, `PriceDiscrepancy`, `DiscrepancyItem`, `AnalyticsSnapshot`, `UpdateBreakdown`
    - Create barrel export file `frontend/src/utils/stockReport/index.ts`
    - _Requirements: 1.1, 2.1, 5.1, 5.2, 6.1_

  - [x] 1.2 Set up testing infrastructure for stock report modules
    - Ensure `fast-check` is installed as a dev dependency
    - Create test directory `frontend/src/utils/stockReport/__tests__/`
    - Verify Vitest configuration supports the new test files
    - _Requirements: All (testing infrastructure)_

- [x] 2. Implement Stock Report Detection
  - [x] 2.1 Implement `StockReportDetector` module
    - Create `frontend/src/utils/stockReport/stockReportDetector.ts`
    - Implement `detectFileType(headers: string[]): DetectionResult` function
    - Detection logic: classify as stock report if ≥2 columns match the stock column set {"stok fisik", "stok sistem", "selisih", "lokasi", "kode barang", "qty", "jumlah"} (case-insensitive after normalization)
    - Return confidence score (number of matched columns), matched column list
    - Return descriptive error if <2 stock columns and no standard import columns found
    - _Requirements: 1.1, 1.2, 1.4_

  - [x] 2.2 Write property test for stock report detection threshold
    - **Property 1: Stock Report Detection Threshold**
    - Generate arbitrary sets of column headers; verify classification is stock report iff ≥2 stock columns present
    - **Validates: Requirements 1.1, 1.2, 1.4**

- [x] 3. Implement Column Mapping
  - [x] 3.1 Implement `StockColumnMapper` module
    - Create `frontend/src/utils/stockReport/stockColumnMapper.ts`
    - Implement `normalizeHeader(header: string): string` — lowercase, trim, collapse internal whitespace
    - Implement `mapColumns(headers: string[]): ColumnMapping` — map headers to known fields or unmapped list
    - Implement `parseNumericValue(value: string): { value: number; warning?: string }` — remove "Rp", dots (thousand sep), non-numeric chars except comma, treat comma as decimal
    - Implement `mapRow(row: Record<string, any>, mapping: ColumnMapping): MappedRow`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 3.2 Write property test for header normalization idempotence
    - **Property 2: Header Normalization Idempotence and Correctness**
    - For arbitrary strings, verify output is lowercase, trimmed, no consecutive whitespace, and applying twice yields same result
    - **Validates: Requirements 2.2**

  - [ ]* 3.3 Write property test for column mapping completeness
    - **Property 3: Column Mapping Completeness**
    - For arbitrary header sets, verify every header maps to exactly one field OR appears in unmapped list
    - **Validates: Requirements 2.1, 2.3**

  - [ ]* 3.4 Write property test for numeric parsing round-trip
    - **Property 4: Numeric Parsing Round-Trip**
    - Format numbers with Indonesian currency conventions, parse with `parseNumericValue`, verify original value recovered
    - **Validates: Requirements 2.4**

- [x] 4. Implement Stock Report Parser
  - [x] 4.1 Implement `StockReportParser` module
    - Create `frontend/src/utils/stockReport/stockReportParser.ts`
    - Implement `parseStockReport(workbook: XLSX.WorkBook, fileName: string): StockParseResult`
    - Implement `extractLocationFromFileName(fileName: string): { location: string | null; date: string | null }`
    - Implement `validateRow(row: MappedRow, rowNumber: number): ParsedStockRow` — valid if name 1-200 chars and ≥1 numeric stock value
    - Implement `deduplicateRows(rows: ParsedStockRow[]): { unique: ParsedStockRow[]; duplicateCount: number }` — keep last occurrence per case-insensitive name
    - Handle merged cells, empty rows, negative stock warnings
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 10.1_

  - [x]* 4.2 Write property test for row validation correctness
    - **Property 5: Row Validation Correctness**
    - Generate arbitrary row data; verify valid iff name 1-200 chars AND ≥1 parseable stock value; verify correct error messages
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [x]* 4.3 Write property test for deduplication preserves last occurrence
    - **Property 6: Deduplication Preserves Last Occurrence**
    - Generate lists with duplicate names; verify exactly one entry per unique name retained, and it's the last occurrence
    - **Validates: Requirements 3.5**

  - [x]* 4.4 Write property test for file name location and date extraction
    - **Property 16: File Name Location and Date Extraction**
    - Generate file names matching "laporan stok {location} {day} {month} {year}" pattern; verify correct extraction
    - **Validates: Requirements 10.1**

- [x] 5. Checkpoint - Ensure parsing modules pass all tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement Analytics Engine
  - [x] 6.1 Implement stock level analytics
    - Create `frontend/src/utils/stockReport/analyticsEngine.ts`
    - Implement `computeStockAnalytics(rows: ParsedStockRow[]): StockAnalytics`
    - Compute: total products, total stock quantity, average stock, zero stock count, below-threshold count
    - Categorize into health groups: Habis (0), Kritis (1-5), Normal (6-50), Berlebih (>50)
    - Compute discrepancies when both physical and system stock present (flag if |diff| > 3)
    - _Requirements: 5.1, 5.2, 5.4, 5.5_

  - [x] 6.2 Implement restock recommendations
    - Implement `generateRestockRecommendations(rows: ParsedStockRow[]): RestockItem[]`
    - Return top 10 products with zero or critical stock (0-5 units), sorted ascending by physical stock
    - _Requirements: 5.3_

  - [x] 6.3 Implement price comparison analytics
    - Implement `computePriceAnalytics(rows: ParsedStockRow[], catalogProducts: Product[]): PriceAnalytics`
    - Compute price difference, percentage change, flag if |%change| > 5%
    - Exclude products with zero/null catalog price, flag as "Harga Katalog Tidak Valid"
    - Sort discrepancies by absolute price difference descending
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x]* 6.4 Write property test for stock health categorization
    - **Property 9: Stock Health Categorization**
    - For arbitrary non-negative stock quantities, verify exactly one category assigned and sum equals total
    - **Validates: Requirements 5.1, 5.2**

  - [x]* 6.5 Write property test for restock list sorted and bounded
    - **Property 10: Restock List Sorted and Bounded**
    - Verify list ≤10 items, sorted ascending by stock, only includes 0-5 stock products
    - **Validates: Requirements 5.3**

  - [x]* 6.6 Write property test for stock discrepancy computation
    - **Property 11: Stock Discrepancy Computation**
    - Verify discrepancy = physical - system, flagged iff |discrepancy| > 3
    - **Validates: Requirements 5.4**

  - [x]* 6.7 Write property test for price analytics computation
    - **Property 12: Price Analytics Computation and Flagging**
    - Verify price difference, percentage change formula, flagged iff |%change| > 5%
    - **Validates: Requirements 6.1, 6.2**

  - [x]* 6.8 Write property test for price discrepancies sorted descending
    - **Property 13: Price Discrepancies Sorted Descending**
    - Verify output sorted by absolute price difference descending
    - **Validates: Requirements 6.5**

- [x] 7. Implement Stock Status Mapping and History Management
  - [x] 7.1 Implement stock quantity to status mapping
    - Create `frontend/src/utils/stockReport/stockStatusMapper.ts`
    - Implement mapping: 0 → "hidden", 1-5 → "indent", >5 → "available"
    - _Requirements: 8.1, 8.2_

  - [x] 7.2 Implement import history manager
    - Create `frontend/src/utils/stockReport/historyManager.ts`
    - Implement saving import records to `bulkImportHistory` localStorage with analytics snapshot
    - Implement 50-record limit with oldest-first removal
    - Handle localStorage quota errors gracefully (warning notification, no blocking)
    - _Requirements: 9.1, 9.2, 9.4, 9.5_

  - [x]* 7.3 Write property test for stock status mapping
    - **Property 14: Stock Quantity to Status Mapping**
    - For arbitrary non-negative integers, verify correct status: 0→hidden, 1-5→indent, >5→available
    - **Validates: Requirements 8.1**

  - [x]* 7.4 Write property test for history buffer bounded
    - **Property 15: Import History Buffer Bounded**
    - For arbitrary sequences of history entries, verify never exceeds 50 records, oldest removed first
    - **Validates: Requirements 9.4**

- [x] 8. Checkpoint - Ensure analytics and utility modules pass all tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement Backend Catalog Match Endpoint
  - [x] 9.1 Implement `GET /api/admin/catalogs/match` endpoint
    - Add new route handler in the backend Rust codebase
    - Accept `names` query parameter (comma-separated, URL-encoded product names)
    - Query SQLite catalog for case-insensitive exact name matches (trim whitespace)
    - Return `MatchResult { matched: Vec<MatchedProduct>, unmatched: Vec<String> }`
    - Handle database errors with 500 response
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x]* 9.2 Write property test for product name matching (Rust)
    - **Property 7: Product Name Matching**
    - Using `proptest`, verify match iff trimmed+lowercased names equal; unmatched marked correctly
    - **Validates: Requirements 4.1, 4.3**

  - [x]* 9.3 Write property test for match count invariant (Rust)
    - **Property 8: Match Count Invariant**
    - Using `proptest`, verify matched_count + unmatched_count = total rows processed
    - **Validates: Requirements 4.4**

- [x] 10. Implement Analytics Dashboard UI
  - [x] 10.1 Create `StockAnalyticsDashboard` React component
    - Create `frontend/src/components/admin/catalog/StockAnalyticsDashboard.tsx`
    - Display summary cards: total products, total stock quantity, products needing restock, price discrepancies
    - Display stock health distribution chart (Habis, Kritis, Normal, Berlebih counts)
    - Display "Rekomendasi Restock" section with up to 10 products, red/warning visual indicator
    - Display "Selisih Harga" section with old price, new price, percentage change
    - Implement product click → scroll to row in preview table with highlight for 2 seconds
    - Display store location in title case and report date in Indonesian locale in header
    - Handle empty state: display message when zero products parsed
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.7, 10.2, 10.3_

  - [x] 10.2 Create `StockUpdateConfirmDialog` component
    - Create `frontend/src/components/admin/catalog/StockUpdateConfirmDialog.tsx`
    - Display breakdown: count changing to "hidden", "indent", "available", and total
    - Implement confirm and cancel actions
    - _Requirements: 8.4_

  - [x] 10.3 Implement CSV export functionality
    - Add "Export Laporan" button to dashboard
    - Generate CSV with columns: product name, stock quantity, health category, catalog price, report price, price difference %, restock recommendation status
    - Trigger file download on click
    - _Requirements: 7.6_

- [x] 11. Integrate Stock Report Flow into Existing Import System
  - [x] 11.1 Wire stock report detection into the upload handler
    - Modify the existing bulk import component to call `detectFileType` after Excel parsing
    - Route to stock report flow when detected, show toast "File terdeteksi sebagai Laporan Stok"
    - Route to existing `productImportHandler` for standard imports
    - Handle file format validation (.xls/.xlsx check) with error message
    - _Requirements: 1.1, 1.2, 1.3, 1.5_

  - [x] 11.2 Wire parsing, matching, and analytics pipeline
    - After detection, call `parseStockReport` → call `/api/admin/catalogs/match` → compute analytics
    - Pass results to `StockAnalyticsDashboard` component
    - Handle catalog API unavailability: show error, preserve parsed data for retry
    - _Requirements: 3.1, 4.1, 4.5, 5.1_

  - [x] 11.3 Wire stock update confirmation and execution
    - On admin confirm, map physical stock to status using `stockStatusMapper`
    - Send bulk update via existing `/api/admin/catalogs/bulk` endpoint
    - Handle partial failures: continue processing, show success/failure summary
    - Preserve other product fields; update price only if price column present
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 11.4 Wire import history saving with analytics snapshot
    - After import completes, save record to localStorage via `historyManager`
    - Include type badge ("Stock Report" vs "Standard Import")
    - Include analytics snapshot for stock reports
    - _Requirements: 9.1, 9.2, 9.3, 9.5_

- [x] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using `fast-check` (frontend) and `proptest` (backend)
- Unit tests validate specific examples and edge cases
- Frontend uses TypeScript/React; backend uses Rust
- The existing `productImportHandler.ts` pattern and `/api/admin/catalogs/bulk` endpoint are reused where possible

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "3.2", "3.3", "3.4", "4.1"] },
    { "id": 3, "tasks": ["4.2", "4.3", "4.4", "7.1", "7.2"] },
    { "id": 4, "tasks": ["6.1", "6.2", "6.3", "7.3", "7.4"] },
    { "id": 5, "tasks": ["6.4", "6.5", "6.6", "6.7", "6.8", "9.1"] },
    { "id": 6, "tasks": ["9.2", "9.3", "10.1", "10.2", "10.3"] },
    { "id": 7, "tasks": ["11.1", "11.2"] },
    { "id": 8, "tasks": ["11.3", "11.4"] }
  ]
}
```
