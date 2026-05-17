# Implementation Plan: Owner Dashboard

## Overview

Implementasi Owner Dashboard eksekutif untuk sistem Tridjaya Manado. Dashboard menampilkan KPI cards, charts (omset per cabang, omset realtime, target vs actual), dan ranking top 10 sales/non-sales. Fase awal menggunakan dummy data module terpisah agar UI dapat di-review sebelum integrasi API. Backend diperluas dengan Owner role variant, frontend mendapat route baru dengan RoleGuard protection.

## Tasks

- [x] 1. Backend: Extend Role Enum with Owner variant
  - [x] 1.1 Add Owner variant to Role enum in `backend/src/auth.rs`
    - Add `Owner` variant to the `Role` enum
    - Update `Display` impl to serialize Owner as "owner"
    - Update `FromStr` impl to parse "owner" (case-insensitive) into `Role::Owner`
    - Update any match arms in auth middleware that handle role-based logic
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.2 Write property test for Role serialization round-trip
    - **Property 1: Role Serialization Round-Trip**
    - Test that serializing any Role variant to string and parsing back produces the original variant
    - Test that any case variation of "owner" parses to Owner variant
    - Create test file `backend/tests/auth_role_owner.rs`
    - **Validates: Requirements 1.1, 1.2**

- [x] 2. Frontend: Auth store and routing updates
  - [x] 2.1 Update UserRole type and DashboardRoot redirect in auth layer
    - Add `'owner'` to `UserRole` type union in `frontend/src/store/authStore.ts`
    - Update `DashboardRoot` component in `frontend/src/App.tsx` to redirect owner role to `/dashboard/owner`
    - _Requirements: 1.4, 2.4_

  - [x] 2.2 Register Owner Dashboard route with RoleGuard
    - Add `/dashboard/owner` route in `frontend/src/App.tsx` wrapped with `RoleGuard` allowing only `["owner"]`
    - Use `lazyPage` pattern for lazy-loading the OwnerDashboard component
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

  - [x] 2.3 Write unit tests for RoleGuard and DashboardRoot owner routing
    - **Property 2: RoleGuard Access Control**
    - Test that RoleGuard with `roles: ["owner"]` permits only owner role
    - Test that DashboardRoot redirects owner to `/dashboard/owner`
    - Test that non-owner roles are redirected away from owner routes
    - Test that unauthenticated users are redirected to `/login`
    - **Validates: Requirements 1.5, 1.6, 2.2**

- [x] 3. Frontend: Create dummy data module and utility functions
  - [x] 3.1 Create TypeScript interfaces and utility functions in `frontend/src/data/ownerDashboardData.ts`
    - Define all interfaces: `KpiCardData`, `BranchOmset`, `HourlyOmset`, `TargetVsActual`, `SalesRanking`, `NonSalesRanking`, `OwnerDashboardData`
    - Implement `formatRupiah()` — format number as "Rp X.XXX.XXX"
    - Implement `calculateTrend()` — return direction and percentage string
    - Implement `calculateConversionRate()` — (closings / prospects) × 100
    - Implement `calculateGapPercentage()` — ((actual - target) / target) × 100
    - Implement `topN()` — sort and limit list with tie-breaking by name
    - _Requirements: 12.6, 5.2, 6.2, 9.4_

  - [x] 3.2 Populate dummy data in `frontend/src/data/ownerDashboardData.ts`
    - Export `ownerDashboardData` object conforming to `OwnerDashboardData` interface
    - Include at least 5 branches with real Sulawesi Utara location names and revenue 50M–500M
    - Include at least 10 sales and 10 non-sales entries with realistic Indonesian names
    - Include prospect counts 20–200, closing counts producing 10–60% conversion rate
    - Include hourly omset data points and 6+ months of target vs actual data
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 3.3 Write property tests for utility functions
    - **Property 3: Trend Calculation Correctness**
    - **Property 4: Rupiah Formatting**
    - **Property 5: Conversion Rate Calculation**
    - **Property 6: Raport Percentage and Threshold Coloring**
    - **Property 7: Branch Omset Sorting**
    - **Property 8: Omset Aggregation**
    - **Property 9: Gap Percentage Calculation and Coloring**
    - **Property 10: Top-N Ranking with Tie-Breaking**
    - Create test file `frontend/src/data/__tests__/ownerDashboardUtils.property.test.ts`
    - Use `fast-check` library with minimum 100 iterations per property
    - **Validates: Requirements 3.2, 3.3, 3.4, 4.2, 4.3, 5.2, 5.3, 5.4, 5.5, 6.2, 6.3, 6.4, 6.5, 7.3, 8.1, 8.4, 8.5, 9.4, 9.6, 9.7, 10.1, 10.3, 10.4, 11.1, 11.4**

  - [x] 3.4 Write unit tests for dummy data validation
    - Verify dummy data module exports all required sections
    - Verify at least 5 branches, 10 sales, 10 non-sales entries
    - Verify prospect counts in range 20–200
    - Verify conversion rates in range 10–60%
    - Create test file `frontend/src/data/__tests__/ownerDashboardData.test.ts`
    - **Validates: Requirements 12.2, 12.3, 12.4, 12.5**

- [x] 4. Checkpoint - Ensure backend and data layer tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Frontend: Implement Owner Dashboard page component
  - [x] 5.1 Create `frontend/src/pages/dashboard/OwnerDashboard.tsx` with KPI cards section
    - Create the main OwnerDashboard component file
    - Import dummy data from `ownerDashboardData.ts`
    - Render within DashboardLayout (via route Outlet)
    - Implement Welcome Banner section
    - Implement 4 KPI cards: Prospek Masuk Hari Ini, Closing Hari Ini, Conversion Rate, Raport Persentase
    - Apply glass-card CSS class with top-edge gradient border
    - Display trend indicators (up/down/neutral arrows) with percentage change
    - Apply green/red color indicators for Raport Persentase based on threshold (>=100% green, <100% red)
    - Use Lucide React icons for all iconography
    - Apply Framer Motion entry animations (staggerChildren, y-offset 16px → 0, spring transition stiffness 110, damping 18)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 5.1, 5.3, 5.4, 5.5, 6.1, 6.3, 6.4, 6.5, 6.6, 13.1, 13.3, 13.4, 13.5, 13.7_

  - [x] 5.2 Implement Omset Per Cabang horizontal bar chart
    - Add Recharts horizontal BarChart component
    - Display branch names on Y-axis, omset values on X-axis
    - Format values as "Rp X.XXX.XXX" using `formatRupiah`
    - Sort branches by omset descending (top to bottom)
    - Handle zero-omset branches displaying "Rp 0"
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 13.2_

  - [x] 5.3 Implement Omset Realtime AreaChart and total KPI
    - Add KPI card showing combined omset of all branches formatted as "Rp X.XXX.XXX"
    - Add Recharts AreaChart showing cumulative revenue throughout the day
    - X-axis: 00:00 to current hour in hourly intervals
    - Y-axis: cumulative omset in Rupiah
    - Handle empty/zero data with flat line at zero
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 13.2_

  - [x] 5.4 Implement Target vs Actual grouped bar chart
    - Add Recharts grouped BarChart comparing Target and Actual side by side per month
    - Use distinct colors for Target and Actual bars
    - Color Actual bars green when >= Target, red when < Target
    - Display values in Rupiah format with axis labels
    - Calculate and display gap percentage per period using `calculateGapPercentage`
    - Color negative gap red, positive gap green
    - Handle zero-target periods showing 0% gap
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 13.2_

  - [x] 5.5 Implement Top 10 Sales ranked list
    - Display ranked list (1–10) with rank number, name, and revenue in Rupiah format
    - Sort descending by revenue, ties broken alphabetically
    - Handle fewer than 10 entries without placeholders
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 5.6 Implement Top 10 Non-Sales ranked table
    - Display ranked table with rank number, name, and contribution count
    - Sort descending by contribution count, ties broken alphabetically
    - Display medal/trophy icons for top 3 entries
    - Handle fewer than 10 entries without placeholders
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 5.7 Implement responsive layout
    - Apply multi-column grid layout (up to 3 columns) for viewport >= 1024px
    - Stack content in single column for viewport < 1024px
    - Collapse sidebar into hamburger menu on mobile
    - Match Admin and Agent dashboard grid patterns
    - _Requirements: 13.6, 13.8_

- [x] 6. Checkpoint - Ensure all frontend components render correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Frontend: Component and integration tests
  - [x] 7.1 Write component rendering tests for OwnerDashboard
    - Test that all KPI sections render without errors
    - Test chart components render with correct Recharts elements
    - Test responsive layout behavior
    - Test medal/trophy icons appear for top 3 entries
    - Test Indonesian language labels are displayed
    - Create test file `frontend/src/pages/dashboard/__tests__/OwnerDashboard.test.tsx`
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8**

  - [x] 7.2 Write integration tests for auth flow
    - Test full auth flow: login as owner → redirect to /dashboard/owner
    - Test route protection: non-owner access denied
    - Test dashboard renders all KPI sections without errors
    - **Validates: Requirements 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5**

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Backend uses Rust with `proptest` crate for property testing
- Frontend uses TypeScript with `fast-check` for property testing and Vitest for unit tests
- All dummy data is isolated in a single module for easy swap to real API later

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "3.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "3.2"] },
    { "id": 2, "tasks": ["2.2", "3.3", "3.4"] },
    { "id": 3, "tasks": ["2.3", "5.1"] },
    { "id": 4, "tasks": ["5.2", "5.3", "5.4", "5.5", "5.6"] },
    { "id": 5, "tasks": ["5.7"] },
    { "id": 6, "tasks": ["7.1", "7.2"] }
  ]
}
```
