# Requirements Document

## Introduction

Fitur Owner Dashboard menyediakan halaman dashboard eksekutif untuk role baru "Owner" di sistem Tridjaya Manado. Dashboard ini menampilkan KPI tingkat tinggi yang mencakup prospek masuk, closing, conversion rate, raport persentase, omset per cabang, omset realtime seluruh cabang, target vs actual, serta ranking top 10 sales dan non-sales. Implementasi awal menggunakan dummy data untuk review sebelum integrasi API.

## Glossary

- **Owner_Dashboard**: Halaman dashboard utama yang hanya dapat diakses oleh user dengan role Owner, menampilkan ringkasan KPI bisnis seluruh cabang
- **Owner**: Role baru dalam sistem yang memiliki akses ke dashboard eksekutif dengan visibilitas lintas cabang
- **Prospek**: Lead atau calon customer yang masuk ke sistem melalui berbagai channel
- **Closing**: Transaksi penjualan yang berhasil diselesaikan (deal closed)
- **Conversion_Rate**: Persentase prospek yang berhasil menjadi closing, dihitung sebagai (jumlah closing / jumlah prospek) × 100
- **Raport_Persentase**: Persentase pencapaian target keseluruhan tim dalam periode tertentu
- **Omset**: Total nilai penjualan (revenue) dalam satuan Rupiah
- **Cabang**: Unit operasional/lokasi bisnis Tridjaya Manado
- **Target**: Angka sasaran penjualan yang ditetapkan untuk periode tertentu
- **Actual**: Angka penjualan yang benar-benar tercapai dalam periode tertentu
- **KPI_Card**: Komponen UI berupa kartu yang menampilkan satu metrik utama beserta indikator tren
- **Role_Enum**: Enum Rust di backend yang mendefinisikan role user (Admin, Agent, Sales, Operator, dan Owner)
- **RoleGuard**: Komponen React yang membatasi akses halaman berdasarkan role user

## Requirements

### Requirement 1: Owner Role Registration

**User Story:** As a system administrator, I want to add the Owner role to the authentication system, so that Owner users can be created and authenticated.

#### Acceptance Criteria

1. THE Role_Enum SHALL include an "Owner" variant alongside existing Admin, Agent, Sales, and Operator variants, serialized as the lowercase string "owner" for storage and API responses
2. WHEN the Auth_System parses a role string of "owner" (case-insensitive), THE Auth_System SHALL return the Owner variant instead of falling back to the default Agent role
3. WHEN a user with role "owner" authenticates via the login endpoint, THE Auth_System SHALL issue an access session token (15-minute expiry) and a refresh session token (7-day or 30-day expiry if remember is true) with the role field set to Owner
4. WHEN the DashboardRoot component detects a user with role "owner", THE Router SHALL redirect to "/dashboard/owner" instead of falling through to the default "/dashboard/agent" path
5. THE RoleGuard SHALL permit access to Owner-specific routes only for users whose stored role equals "owner"
6. IF a non-Owner user attempts to access an Owner-specific route, THEN THE RoleGuard SHALL redirect the user to "/dashboard"

### Requirement 2: Owner Dashboard Route Protection

**User Story:** As an Owner, I want my dashboard to be accessible only to me, so that sensitive business KPIs are not visible to other roles.

#### Acceptance Criteria

1. THE Router SHALL register a "/dashboard/owner" route protected by RoleGuard with roles array containing only "owner"
2. WHEN a user with a role other than "owner" navigates to any path under "/dashboard/owner", THE RoleGuard SHALL redirect the user to "/dashboard" which resolves to their role-appropriate dashboard via DashboardRoot
3. WHEN an unauthenticated user navigates to any path under "/dashboard/owner", THE PrivateRoute SHALL redirect the user to "/login" with the attempted location preserved in router state
4. WHEN a user with role "owner" navigates to "/dashboard", THE DashboardRoot SHALL redirect the user to "/dashboard/owner"
5. WHEN a user with role "owner" is authenticated and navigates to "/dashboard/owner", THE Router SHALL render the owner dashboard page within the DashboardLayout

### Requirement 3: Prospek Masuk Hari Ini

**User Story:** As an Owner, I want to see the number of incoming prospects today, so that I can monitor daily lead generation activity.

#### Acceptance Criteria

1. THE Owner_Dashboard SHALL display a KPI_Card showing the total number of prospects received today as a whole integer with a label "Prospek Masuk Hari Ini"
2. THE KPI_Card SHALL display a trend indicator showing an up-arrow icon when today's count exceeds yesterday's count, a down-arrow icon when today's count is less than yesterday's count, and no arrow when counts are equal, accompanied by the percentage change value calculated as ((today - yesterday) / yesterday) × 100 rounded to one decimal place
3. IF yesterday's prospect count is zero and today's count is greater than zero, THEN THE KPI_Card SHALL display an up-arrow icon with the text "+100%"
4. IF both today's and yesterday's prospect counts are zero, THEN THE KPI_Card SHALL display no trend arrow and show "0%" as the percentage change
5. WHEN the dashboard loads, THE Owner_Dashboard SHALL retrieve prospect data for the current date (using dummy data in initial implementation)

### Requirement 4: Closing Hari Ini

**User Story:** As an Owner, I want to see the number of closings today, so that I can monitor daily sales performance.

#### Acceptance Criteria

1. THE Owner_Dashboard SHALL display a KPI_Card showing the total number of closings completed today, formatted as a whole number with dot thousands separator (e.g., "1.234"), accompanied by a label identifying the metric as "Closing Hari Ini"
2. THE KPI_Card SHALL display a trend indicator showing an upward arrow when today's closing count exceeds yesterday's, a downward arrow when today's count is less than yesterday's, or a neutral indicator when counts are equal, along with the percentage change value rounded to one decimal place
3. IF yesterday's closing count is zero and today's closing count is greater than zero, THEN THE KPI_Card SHALL display an upward arrow with no percentage value
4. WHEN the dashboard loads, THE Owner_Dashboard SHALL retrieve closing data for the current date (using dummy data in initial implementation)

### Requirement 5: Conversion Rate

**User Story:** As an Owner, I want to see the conversion percentage, so that I can evaluate the effectiveness of the sales funnel.

#### Acceptance Criteria

1. THE Owner_Dashboard SHALL display a KPI_Card showing the Conversion_Rate formatted as a percentage with exactly one decimal place (e.g., "23.5%")
2. THE Owner_Dashboard SHALL calculate Conversion_Rate as (total closings today / total prospects today) × 100
3. THE KPI_Card SHALL display a trend indicator comparing today's Conversion_Rate to yesterday's Conversion_Rate, showing an upward indicator when today's rate is higher, a downward indicator when today's rate is lower, and a neutral indicator when the rates are equal
4. IF the total prospect count for today is zero, THEN THE Owner_Dashboard SHALL display the Conversion_Rate as "0.0%"
5. IF the total prospect count for yesterday is zero, THEN THE KPI_Card SHALL display the trend indicator in neutral state with no percentage difference

### Requirement 6: Raport Persentase

**User Story:** As an Owner, I want to see the overall achievement report percentage, so that I can assess team performance against targets.

#### Acceptance Criteria

1. THE Owner_Dashboard SHALL display a KPI_Card showing the Raport_Persentase value formatted as a percentage with exactly one decimal place (e.g., "85.3%")
2. THE Owner_Dashboard SHALL calculate Raport_Persentase as (total actual achievement / total target) × 100 for the current month
3. IF the Raport_Persentase is greater than or equal to 100%, THEN THE KPI_Card SHALL display the value with a green visual indicator
4. IF the Raport_Persentase is less than 100%, THEN THE KPI_Card SHALL display the value with a red visual indicator
5. IF the total target is zero, THEN THE Owner_Dashboard SHALL display the Raport_Persentase as "0.0%" with a red visual indicator
6. WHEN the dashboard loads, THE Owner_Dashboard SHALL retrieve target and actual achievement data for the current month (using dummy data in initial implementation)

### Requirement 7: Omset Per Cabang

**User Story:** As an Owner, I want to see revenue broken down by branch, so that I can compare performance across locations.

#### Acceptance Criteria

1. THE Owner_Dashboard SHALL display a horizontal bar chart showing Omset for each Cabang, with the Cabang name on the Y-axis and the Omset value on the X-axis
2. THE bar chart SHALL label each bar with the Cabang name and display the Omset value in Indonesian Rupiah format "Rp X.XXX.XXX" using dot as thousands separator and no decimal places
3. THE Owner_Dashboard SHALL sort branches by Omset value in descending order from top to bottom
4. WHEN the dashboard loads, THE Owner_Dashboard SHALL retrieve per-branch revenue data from dummy data containing between 4 and 6 branches with realistic Manado-area names (e.g., "Manado Pusat", "Tomohon", "Bitung")
5. IF a Cabang has zero Omset, THEN THE Owner_Dashboard SHALL still display that Cabang in the chart with a value of "Rp 0"

### Requirement 8: Omset Realtime All Cabang

**User Story:** As an Owner, I want to see the total realtime revenue across all branches, so that I can monitor overall business performance at a glance.

#### Acceptance Criteria

1. THE Owner_Dashboard SHALL display a KPI_Card showing the combined Omset of all branches as a single numeric value
2. THE Owner_Dashboard SHALL format the total Omset value with the prefix "Rp", using dot (.) as thousands separator and no decimal places (e.g., "Rp 1.250.000.000")
3. THE Owner_Dashboard SHALL display a Recharts AreaChart showing revenue accumulation throughout the current day, with the X-axis spanning from 00:00 to the current hour in hourly intervals and the Y-axis representing cumulative Omset in Rupiah
4. WHEN the dashboard loads, THE Owner_Dashboard SHALL aggregate Omset from all Cabang entries using dummy data that provides one data point per hour from 00:00 up to the current hour
5. IF all Cabang entries have zero Omset or no data is available, THEN THE Owner_Dashboard SHALL display "Rp 0" in the KPI_Card and render the AreaChart with a flat line at zero

### Requirement 9: Target vs Actual

**User Story:** As an Owner, I want to compare target versus actual performance, so that I can identify gaps and take corrective action.

#### Acceptance Criteria

1. THE Owner_Dashboard SHALL display a grouped bar chart comparing Target and Actual values side by side, broken down by month for the current year
2. THE chart SHALL use distinct colors for Target bars and Actual bars, and SHALL color Actual bars green when Actual meets or exceeds Target and red when Actual is below Target
3. THE chart SHALL display both values in Indonesian Rupiah format (e.g., "Rp 50.000.000") with axis labels indicating the period name and value scale
4. THE Owner_Dashboard SHALL calculate the gap percentage as ((Actual − Target) / Target) × 100, rounded to one decimal place, and display it for each period
5. WHEN the dashboard loads, THE Owner_Dashboard SHALL retrieve target and actual data for at least 6 monthly periods including a mix of over-performing and under-performing entries (using dummy data in initial implementation)
6. IF the Target value for a period is zero, THEN THE Owner_Dashboard SHALL display the gap percentage as 0% for that period
7. THE Owner_Dashboard SHALL display negative gap percentages in red and positive gap percentages in green

### Requirement 10: Top 10 Sales

**User Story:** As an Owner, I want to see the top 10 performing sales personnel, so that I can recognize high performers.

#### Acceptance Criteria

1. THE Owner_Dashboard SHALL display a ranked list of the top 10 users with role "sales" by total revenue generated within the current calendar month
2. THE ranked list SHALL show rank number (1–10), sales person name, and total revenue in Indonesian Rupiah format (e.g., "Rp 1.250.000.000")
3. THE Owner_Dashboard SHALL sort the list in descending order by revenue, with ties broken by alphabetical order of sales person name
4. IF fewer than 10 sales personnel have recorded revenue in the current month, THEN THE Owner_Dashboard SHALL display only the available entries without placeholder rows
5. WHEN the dashboard loads, THE Owner_Dashboard SHALL retrieve sales performance data for the current calendar month (using dummy data in initial implementation)

### Requirement 11: Top 10 Non-Sales

**User Story:** As an Owner, I want to see the top 10 performing non-sales personnel (agents), so that I can recognize contributors outside the direct sales team.

#### Acceptance Criteria

1. THE Owner_Dashboard SHALL display a ranked table of the top 10 non-sales personnel (users with role "agent") sorted in descending order by their total contribution count for the current calendar month, where contribution count is the sum of leads generated and referrals made
2. THE ranked table SHALL show rank number, person name, and contribution count as a whole number
3. THE Owner_Dashboard SHALL display medal or trophy icons next to the rank number for the top 3 entries to visually distinguish highest contributors
4. IF fewer than 10 non-sales personnel have contribution data for the current month, THEN THE Owner_Dashboard SHALL display only the available entries without placeholder rows
5. WHEN the dashboard loads, THE Owner_Dashboard SHALL retrieve agent performance data for the current calendar month (using dummy data with realistic Indonesian names in initial implementation)

### Requirement 12: Dummy Data Implementation

**User Story:** As a developer, I want the initial dashboard to use realistic dummy data, so that the Owner can review the layout and provide feedback before API integration.

#### Acceptance Criteria

1. THE Owner_Dashboard SHALL load all dashboard data from a single dedicated dummy data module that is separate from UI components
2. THE dummy data module SHALL include at least 5 branches using real Sulawesi Utara location names, each with revenue values ranging from 50,000,000 to 500,000,000 Rupiah
3. THE dummy data SHALL include at least 10 sales and 10 non-sales personnel entries with realistic Indonesian names and distinct performance values
4. THE dummy data SHALL include prospect counts between 20 and 200 and closing counts that produce conversion rates between 10% and 60%
5. THE dummy data module SHALL provide data for every KPI section of the Owner_Dashboard: prospects, closings, conversion rate, raport persentase, omset per cabang, total omset, target vs actual, top 10 sales, and top 10 non-sales
6. THE dummy data module SHALL export data structures that match the expected API response format so that replacing the module with real API calls requires no changes to UI components

### Requirement 13: Dashboard UI Consistency

**User Story:** As an Owner, I want the dashboard to follow the same visual style as other dashboards in the system, so that the experience feels cohesive.

#### Acceptance Criteria

1. THE Owner_Dashboard SHALL render within the shared DashboardLayout component, which provides sidebar navigation and a main content area via router Outlet
2. THE Owner_Dashboard SHALL use Recharts library for all chart visualizations
3. WHEN the Owner_Dashboard page loads, THE Owner_Dashboard SHALL apply Framer Motion entry animations using a container variant with staggerChildren delay and item variants that animate from y-offset 16px to 0 with spring transition (stiffness 110, damping 18)
4. THE Owner_Dashboard SHALL use Lucide React icons for all iconography
5. THE Owner_Dashboard SHALL display all text labels in Indonesian language
6. WHEN the viewport width is below 1024px, THE Owner_Dashboard layout SHALL collapse the sidebar into a hamburger menu and stack content sections in a single column
7. THE Owner_Dashboard SHALL apply the glass-card CSS class with top-edge gradient border for all card containers, consistent with the existing Tailwind CSS 3.4 design system
8. WHEN the viewport width is 1024px or above, THE Owner_Dashboard SHALL display content in a multi-column grid layout (up to 3 columns) matching the Admin and Agent dashboard grid patterns
