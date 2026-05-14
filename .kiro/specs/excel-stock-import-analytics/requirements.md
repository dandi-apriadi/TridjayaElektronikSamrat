# Requirements Document

## Introduction

This feature enhances the existing Excel bulk import system at `/dashboard/admin/catalog/bulk-import` to support stock report files (e.g., "laporan stok te samrat 11 mei 2026_berheader.xlsx") from physical store locations. Beyond importing stock data, the system will generate analytics and decision-making insights such as stock level summaries, price discrepancies, restock recommendations, and inventory health indicators. This enables store managers and admin staff to make informed inventory decisions directly from the import dashboard.

## Glossary

- **Stock_Report_Parser**: The module responsible for detecting and parsing stock report Excel files with non-standard column formats (e.g., store-specific inventory reports from TE Samrat location)
- **Analytics_Engine**: The module that computes decision-making insights from parsed stock data, including stock level analysis, price comparisons, and restock recommendations
- **Import_System**: The existing bulk import system at `/dashboard/admin/catalog/bulk-import` that handles Excel file upload, parsing, preview, and bulk create/update operations
- **Stock_Report_File**: An Excel file containing inventory/stock data from a physical store location, with columns specific to stock tracking (product name, quantity on hand, location, etc.)
- **Analytics_Dashboard**: The UI panel that displays computed insights and recommendations after a stock report file is parsed
- **Catalog_Database**: The SQLite database containing the products table with fields including id, name, category, price, stock, and related product information
- **Column_Mapper**: The component that normalizes and maps non-standard column headers from stock report files to the internal data model

## Requirements

### Requirement 1: Stock Report File Detection

**User Story:** As an admin, I want the import system to automatically detect when I upload a stock report file, so that it applies the correct parsing logic without manual configuration.

#### Acceptance Criteria

1. WHEN an Excel file is uploaded, THE Stock_Report_Parser SHALL read the first row of the first worksheet as column headers and analyze them to determine if the file is a stock report format or a standard product import format
2. WHEN the file contains at least 2 of the following stock-report-specific columns (case-insensitive, after trimming whitespace): "stok fisik", "stok sistem", "selisih", "lokasi", "kode barang", "qty", "jumlah", THE Stock_Report_Parser SHALL classify the file as a stock report
3. WHEN the file is classified as a stock report, THE Import_System SHALL display a toast notification indicating "File terdeteksi sebagai Laporan Stok" to the admin
4. IF the file contains fewer than 2 recognizable stock-report columns AND does not match the standard product import format (no "nama"/"name"/"harga"/"price" columns), THEN THE Stock_Report_Parser SHALL return a descriptive error message listing expected column formats for both stock report and standard import
5. IF the uploaded file is not a valid Excel format (.xls, .xlsx) or cannot be parsed, THEN THE Stock_Report_Parser SHALL return an error message "Format file tidak valid. Gunakan file Excel (.xls atau .xlsx)"

### Requirement 2: Stock Report Column Mapping

**User Story:** As an admin, I want the system to correctly map columns from store-specific stock report formats, so that inventory data is properly extracted regardless of column naming conventions.

#### Acceptance Criteria

1. THE Column_Mapper SHALL support the following stock report column variations: "nama barang"/"nama produk"/"product name" for product name, "stok fisik"/"qty"/"jumlah" for physical stock quantity, "stok sistem" for system stock quantity, "harga jual"/"harga"/"price" for selling price, "lokasi"/"location"/"gudang" for store location, "kode barang"/"kode"/"sku" for product code
2. WHEN a stock report file is parsed, THE Column_Mapper SHALL normalize all column headers by converting to lowercase, trimming leading and trailing whitespace, and collapsing consecutive internal whitespace to a single space before matching against known column variations
3. WHEN a column header does not match any known mapping after normalization, THE Column_Mapper SHALL preserve the column data under its original header name for display in the preview
4. THE Column_Mapper SHALL parse numeric values by removing currency symbols (e.g., "Rp"), thousand separators (dots), and non-numeric characters except commas, then treating a comma as the decimal separator before converting to a numeric value
5. IF a cell value in a mapped numeric column (physical stock, system stock, or selling price) cannot be converted to a valid number after cleanup, THEN THE Column_Mapper SHALL treat the value as 0 and flag the cell with a warning indicating the original value that failed conversion

### Requirement 3: Stock Data Parsing and Validation

**User Story:** As an admin, I want the system to validate stock report data during parsing, so that only clean and correct data enters the analytics pipeline.

#### Acceptance Criteria

1. WHEN a stock report row contains a product name of 1 to 200 characters (after trimming whitespace) and at least one numeric stock value, THE Stock_Report_Parser SHALL include the row in the parsed result set
2. IF a row contains an empty product name or a product name consisting only of whitespace, THEN THE Stock_Report_Parser SHALL mark the row as invalid with error message "Nama produk tidak boleh kosong"
3. IF a row contains a product name but no parseable numeric stock value in any stock column, THEN THE Stock_Report_Parser SHALL mark the row as invalid with error message "Tidak ada nilai stok yang valid"
4. IF a stock quantity value is negative, THEN THE Stock_Report_Parser SHALL flag the row with a warning "Stok negatif terdeteksi" and include it in the result set for review
5. WHEN duplicate product names exist in the same file (compared case-insensitively after trimming whitespace), THE Stock_Report_Parser SHALL keep only the last occurrence and log a warning indicating the duplicate row numbers
6. THE Stock_Report_Parser SHALL skip rows where all cells are empty or contain only whitespace, without generating errors
7. THE Stock_Report_Parser SHALL skip merged cells that span multiple rows by processing only the first row of the merged range, without generating errors

### Requirement 4: Product Matching with Catalog

**User Story:** As an admin, I want imported stock data to be matched against existing products in the catalog, so that I can see which products need stock updates.

#### Acceptance Criteria

1. WHEN a stock report is parsed, THE Import_System SHALL match each row against existing products in the Catalog_Database using case-insensitive exact name matching after trimming leading and trailing whitespace from both the report product name and the catalog product name
2. WHEN a product from the stock report matches an existing catalog product, THE Import_System SHALL display the catalog product's current stock status field value ("available", "hidden", or "indent") alongside the reported physical stock quantity from the stock report
3. WHEN a product from the stock report has no match in the catalog, THE Import_System SHALL mark it as "Produk tidak ditemukan di katalog" and include it as a listed entry in the analytics summary with its product name and reported stock quantity
4. WHEN product matching is complete, THE Import_System SHALL display a match summary showing total matched count, unmatched count, and total rows processed count
5. IF the Catalog_Database is unavailable during the matching operation, THEN THE Import_System SHALL display an error message indicating the catalog cannot be reached and abort the matching process while preserving the parsed stock report data for retry

### Requirement 5: Stock Level Analytics

**User Story:** As an admin, I want to see stock level analytics after importing a stock report, so that I can identify products that need restocking or have excess inventory.

#### Acceptance Criteria

1. WHEN a stock report is successfully parsed, THE Analytics_Engine SHALL compute the following metrics using the physical stock quantity ("stok fisik") column: total unique products, total stock quantity across all products, average stock per product (rounded to 1 decimal place), number of products with zero stock, number of products with stock below a threshold of 5 units
2. THE Analytics_Engine SHALL categorize products into stock health groups based on physical stock quantity: "Habis" (zero stock), "Kritis" (1-5 units), "Normal" (6-50 units), "Berlebih" (more than 50 units)
3. THE Analytics_Engine SHALL generate a ranked list of products sorted by physical stock quantity ascending, displaying the top 10 products most urgently needing restock with a distinct visual indicator (e.g., red background or warning icon)
4. WHEN both physical stock ("stok fisik") and system stock ("stok sistem") columns are present, THE Analytics_Engine SHALL compute the discrepancy as (physical stock minus system stock) and flag products where the absolute difference exceeds 3 units with a "Selisih Stok" warning
5. IF the stock report contains only a system stock column and no physical stock column, THEN THE Analytics_Engine SHALL use the system stock values for all analytics computations

### Requirement 6: Price Comparison Analytics

**User Story:** As an admin, I want to compare prices in the stock report against catalog prices, so that I can identify pricing discrepancies that need correction.

#### Acceptance Criteria

1. WHEN a stock report contains price data and a product matches an existing catalog entry, THE Analytics_Engine SHALL compute the price difference as (report price minus catalog price) and the percentage change as ((report price minus catalog price) divided by catalog price) multiplied by 100
2. IF the absolute percentage change between the report price and the catalog price exceeds 5%, THEN THE Analytics_Engine SHALL flag the product as "Perlu Review Harga"
3. IF a matched product has a catalog price of zero or null, THEN THE Analytics_Engine SHALL exclude that product from percentage-based comparison and flag it as "Harga Katalog Tidak Valid"
4. WHEN price comparison analytics are computed, THE Analytics_Engine SHALL display a summary showing: total products with price data, number of products with price increases (report price greater than catalog price), number of products with price decreases (report price less than catalog price), and average absolute price change percentage across all compared products
5. THE Analytics_Engine SHALL sort price discrepancies by absolute price difference in descending order for prioritized review

### Requirement 7: Analytics Dashboard Display

**User Story:** As an admin, I want to see all analytics insights in a clear visual dashboard after importing a stock report, so that I can quickly make inventory decisions.

#### Acceptance Criteria

1. WHEN a stock report is parsed and analytics are computed, THE Analytics_Dashboard SHALL display a summary card section with key metrics (total products, total stock quantity, products needing restock, price discrepancies found)
2. WHEN a stock report is parsed and analytics are computed, THE Analytics_Dashboard SHALL display a stock health distribution chart showing the count of products in each health category (Habis, Kritis, Normal, Berlebih) as defined in Requirement 5
3. WHEN a stock report is parsed and analytics are computed, THE Analytics_Dashboard SHALL display a "Rekomendasi Restock" section listing up to 10 products with zero or critical stock levels (1-5 units), sorted by stock quantity ascending (zero stock first, then lowest quantity first)
4. WHEN a stock report is parsed and analytics are computed, THE Analytics_Dashboard SHALL display a "Selisih Harga" section listing products where the price difference exceeds 5% of the catalog price, showing old price, new price, and percentage change, sorted by absolute percentage change descending
5. WHEN the admin clicks on a product in any analytics section, THE Analytics_Dashboard SHALL scroll the import preview table to the selected product row and apply a visible highlight style to that row for at least 2 seconds
6. WHEN the admin clicks the "Export Laporan" button, THE Analytics_Dashboard SHALL download a CSV file containing the analytics summary including: product name, stock quantity, stock health category, catalog price, report price, price difference percentage, and restock recommendation status
7. IF the analytics computation produces no results (zero products parsed), THEN THE Analytics_Dashboard SHALL display an empty state message indicating no analytics data is available instead of showing empty sections

### Requirement 8: Stock Update from Report

**User Story:** As an admin, I want to update catalog stock status based on the stock report data, so that the online catalog reflects actual physical inventory.

#### Acceptance Criteria

1. WHEN the admin confirms the import, THE Import_System SHALL update matched products' stock field based on the physical stock quantity ("stok fisik") from the report: set to "hidden" if quantity equals 0, set to "indent" if quantity is between 1 and 5 inclusive, set to "available" if quantity is greater than 5
2. IF both "stok fisik" and "stok sistem" columns are present in the stock report, THEN THE Import_System SHALL use the "stok fisik" value for determining stock status
3. WHEN updating stock status, THE Import_System SHALL preserve all other product fields (price, category, description, images) unchanged unless the stock report contains a mapped price column, in which case the price field SHALL also be updated for matched products
4. WHEN the admin initiates the stock update action, THE Import_System SHALL display a confirmation dialog showing the total number of products to be updated and a breakdown by target status (count of products changing to "hidden", "indent", and "available")
5. IF the bulk update operation fails for any product, THEN THE Import_System SHALL continue processing remaining products and display a result summary showing: total products updated successfully, total products failed, and for each failed product the product name and the reason for failure
6. WHEN the bulk update completes, THE Import_System SHALL display a result summary showing the total number of products processed, the number of successful updates, and the number of unchanged products within 5 seconds of the last product being processed

### Requirement 9: Import History with Analytics

**User Story:** As an admin, I want stock report imports to be saved in history with their analytics snapshots, so that I can track inventory changes over time.

#### Acceptance Criteria

1. WHEN a stock report import processing completes (regardless of whether some individual product updates failed), THE Import_System SHALL save the import record to the existing `bulkImportHistory` localStorage key including: file name, upload timestamp, total products processed, success count, error count, and analytics snapshot containing stock health distribution counts per category (Habis, Kritis, Normal, Berlebih), price discrepancies count, and restock recommendations count
2. WHEN a standard (non-stock-report) import processing completes, THE Import_System SHALL save the import record to the same `bulkImportHistory` localStorage key with a type field value of "Standard Import" and without analytics snapshot data
3. WHEN viewing import history, THE Import_System SHALL display a visually distinct badge on each record indicating the import type: "Stock Report" or "Standard Import"
4. THE Import_System SHALL retain the last 50 import history records in the `bulkImportHistory` localStorage key, removing the oldest entries first when the limit is exceeded
5. IF writing to localStorage fails due to quota or unavailability, THEN THE Import_System SHALL display a warning notification to the admin indicating that the history record could not be saved, without blocking the import completion

### Requirement 10: Store Location Context

**User Story:** As an admin, I want the system to extract and display the store location from the stock report file name or content, so that analytics are contextualized to the correct store.

#### Acceptance Criteria

1. WHEN a stock report file is uploaded, THE Stock_Report_Parser SHALL extract the store location from the file name by identifying the text segment between the prefix "laporan stok" (case-insensitive) and the date portion (Indonesian date pattern: day + Indonesian month name + year), trimming whitespace and underscores from the result
2. WHEN a store location is successfully extracted, THE Analytics_Dashboard SHALL display the location name in title case as the first element in the analytics header section (e.g., "Laporan Stok - TE Samrat")
3. WHEN the report date is extracted from the file name, THE Analytics_Dashboard SHALL display the report date in "DD MMMM YYYY" Indonesian locale format (e.g., "11 Mei 2026") adjacent to the location name in the analytics header
4. IF the file name contains a date portion but no location text is found between the prefix and the date, THEN THE Analytics_Dashboard SHALL display "Lokasi tidak terdeteksi" as the location while still displaying the extracted date
5. IF no Indonesian date pattern (day + month name from: januari, februari, maret, april, mei, juni, juli, agustus, september, oktober, november, desember + 4-digit year) can be identified in the file name, THEN THE Analytics_Dashboard SHALL use the file upload timestamp formatted as "DD MMMM YYYY" as the report date
6. IF the file name does not begin with "laporan stok" (case-insensitive), THEN THE Stock_Report_Parser SHALL attempt to extract the location from a "lokasi" column value in the first valid data row of the file content
