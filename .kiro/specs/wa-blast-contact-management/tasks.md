# Implementation Plan: WA Blast Contact Management

## Overview

Implement a centralized contact database for the WA Blast system with group management, Excel import/export, and campaign integration. The backend uses Rust (Axum + SQLite/sqlx) and the frontend uses React + TypeScript with Tailwind CSS.

## Tasks

- [ ] 1. Database migration and core module setup
  - [ ] 1.1 Create database migration file `2026051301_wa_blast_contacts.sql`
    - Create `wa_blast_contact_groups` table (id, name, description, created_at)
    - Create `wa_blast_contacts` table (id, phone, name, group_id, variables_json, created_at, updated_at)
    - Add UNIQUE constraint on (phone, group_id)
    - Add indexes on phone, group_id, name, and composite (phone, group_id)
    - _Requirements: 1.1, 2.1_

  - [ ] 1.2 Create backend module `src/wa_blast_contacts.rs` with struct definitions
    - Define `BlastContact`, `BlastContactGroup`, `CreateBlastContactRequest`, `UpdateBlastContactRequest`, `ImportResult`, `ImportRowError` structs
    - Define query parameter structs for pagination/search/filter
    - Add `pub mod wa_blast_contacts;` to `main.rs`
    - _Requirements: 1.1, 1.6_

- [ ] 2. Phone validation function
  - [ ] 2.1 Implement `validate_and_normalize_phone` function
    - Strip allowed non-digit characters (+, space, dash)
    - Reject strings with disallowed characters
    - Normalize prefix: 08xx → 628xx, +628xx → 628xx, 8xx → 628xx
    - Validate length: 10-15 digits after normalization
    - Return `Result<String, String>` with descriptive error messages
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ] 2.2 Write property test: Phone normalization idempotence
    - **Property 1: Phone normalization idempotence**
    - Generate random valid phone numbers in various formats (08xx, 628xx, +628xx, 8xx)
    - Assert `normalize(normalize(x)) == normalize(x)` for all valid inputs
    - **Validates: Requirements 5.1, 5.2**

  - [ ] 2.3 Write property test: Invalid phone rejection
    - **Property 2: Invalid phone rejection**
    - Generate strings with non-digit characters (excluding +, space, dash) or invalid lengths (<10 or >15 digits)
    - Assert all are rejected with an error
    - **Validates: Requirements 5.3, 5.4**

- [ ] 3. Contact group CRUD endpoints
  - [ ] 3.1 Implement group handlers: list, create, update, delete
    - `list_blast_contact_groups`: GET `/api/wa/blast-contact-groups` — return groups with contact_count via LEFT JOIN + COUNT
    - `create_blast_contact_group`: POST — validate unique name, generate UUID, insert
    - `update_blast_contact_group`: PATCH `/{id}` — validate unique name if changed, update
    - `delete_blast_contact_group`: DELETE `/{id}` — delete group, SQLite ON DELETE SET NULL handles contacts
    - All handlers use `authorize(&state, &headers, &[Role::Admin, Role::WaAdmin, Role::WaOperator])`
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ] 3.2 Write property test: Group deletion nullifies contacts
    - **Property 7: Group deletion nullifies contacts**
    - Create a group with N contacts, delete the group, verify all contacts still exist with group_id = NULL
    - **Validates: Requirements 2.3**

- [ ] 4. Contact CRUD endpoints
  - [ ] 4.1 Implement contact handlers: list (paginated/search/filter), create, update, delete, bulk-delete
    - `list_blast_contacts`: GET `/api/wa/blast-contacts` — pagination (page, per_page), search (name/phone LIKE), filter by group_id, JOIN group name
    - `create_blast_contact`: POST — validate phone via `validate_and_normalize_phone`, check unique(phone, group_id), insert
    - `update_blast_contact`: PATCH `/{id}` — validate phone if changed, check uniqueness, update
    - `delete_blast_contact`: DELETE `/{id}` — delete single contact
    - `bulk_delete_blast_contacts`: POST `/bulk-delete` — accept `{ ids: Vec<String> }`, delete all in one query
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ] 4.2 Write property test: Duplicate phone within same group is rejected
    - **Property 3: Duplicate phone within same group is rejected**
    - Insert a contact with phone P in group G, attempt to insert another with same normalized phone P in same group G
    - Assert the second insert fails and database state is unchanged
    - **Validates: Requirements 1.3**

- [ ] 5. Checkpoint - Ensure backend CRUD compiles and tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Excel template download endpoint
  - [ ] 6.1 Add `rust_xlsxwriter` dependency to Cargo.toml and implement template download handler
    - Add `rust_xlsxwriter = "0.79"` to `[dependencies]` in Cargo.toml
    - Implement `download_blast_contacts_template`: GET `/api/wa/blast-contacts/template`
    - Generate .xlsx with Sheet 1 "Data": headers (phone, name, var1, var2) + 2 example rows
    - Generate Sheet 2 "Instruksi": format instructions explaining accepted phone formats
    - Return with `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` and `Content-Disposition: attachment; filename="template_kontak_wa.xlsx"`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 7. Excel import endpoint
  - [ ] 7.1 Implement Excel import handler with validation and upsert logic
    - Implement `import_blast_contacts`: POST `/api/wa/blast-contacts/import` (multipart, 5MB limit)
    - Accept `group_id` form field and file upload
    - Parse .xlsx (calamine) or .csv — detect by extension/content-type
    - Validate header row contains "phone" column
    - Validate file size ≤ 5MB and row count ≤ 10,000
    - For each row: validate phone, deduplicate within file (first occurrence wins), upsert to DB
    - Return `ImportResult` JSON with inserted, updated, skipped, errors counts
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [ ] 7.2 Write property test: Excel import upsert correctness
    - **Property 4: Excel import upsert correctness**
    - Generate N unique valid phones, pre-insert M of them, run import, verify exactly (N-M) insertions and M updates
    - **Validates: Requirements 4.5, 4.6**

  - [ ] 7.3 Write property test: Excel import in-file deduplication
    - **Property 5: Excel import in-file deduplication**
    - Generate file with duplicate phone numbers, verify only first occurrence is processed
    - **Validates: Requirements 4.4**

  - [ ] 7.4 Write property test: Import summary arithmetic consistency
    - **Property 6: Import summary arithmetic consistency**
    - For any import of T rows, verify `inserted + updated + skipped + errors.len() == T`
    - **Validates: Requirements 4.6**

- [ ] 8. Campaign integration endpoint
  - [ ] 8.1 Implement copy-contacts-to-campaign handler
    - Implement `add_recipients_from_contacts`: POST `/api/wa/campaigns/{id}/recipients/from-contacts`
    - Accept `{ group_ids: Vec<String> }` body
    - Query blast contacts from specified groups
    - Insert into `wa_recipients` with status "pending", preserving phone and variables_json (name, var1, var2)
    - Skip contacts already in campaign (by phone)
    - Return count of added recipients
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ] 8.2 Write property test: Campaign contact copy preserves all data
    - **Property 8: Campaign contact copy preserves all data**
    - Create contacts with known variables, copy to campaign, verify wa_recipients rows have identical phone and variables
    - **Validates: Requirements 6.2, 6.3**

- [ ] 9. Register all routes in `routes.rs`
  - [ ] 9.1 Add route registrations to the main router
    - Add `use crate::wa_blast_contacts;` import
    - Register group routes: GET/POST `/api/wa/blast-contact-groups`, PATCH/DELETE `/{id}`
    - Register contact routes: GET/POST `/api/wa/blast-contacts`, PATCH/DELETE `/{id}`, POST `/bulk-delete`, GET `/template`
    - Register import route in upload_routes (with 5MB body limit): POST `/api/wa/blast-contacts/import`
    - Register campaign integration: POST `/api/wa/campaigns/{id}/recipients/from-contacts`
    - _Requirements: 1.6, 2.1, 3.4, 4.1, 6.1_

- [ ] 10. Checkpoint - Ensure full backend compiles and all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Frontend: Contact management page and group modal
  - [ ] 11.1 Create `AdminWaContactsPage` component
    - Create file at `frontend/src/pages/dashboard/AdminWaContactsPage.tsx`
    - Glass-card layout with stats cards (total contacts, total groups)
    - Data table with columns: Phone, Name, Group, Created At
    - Checkbox column for bulk selection
    - Pagination controls (page, per_page)
    - Debounced search input (name/phone)
    - Group filter dropdown
    - Action buttons: Download Template, Import Excel, Add Contact, Bulk Delete
    - Use existing API patterns (fetch with auth headers)
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ] 11.2 Create `ContactGroupModal` component
    - Create modal for group CRUD operations
    - List groups with contact count badges
    - Inline create/edit/delete for each group
    - Confirmation dialog before group deletion
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 12. Frontend: Import Excel dialog and campaign integration
  - [ ] 12.1 Create `ImportExcelDialog` component
    - Drag-and-drop upload area with click fallback
    - File type validation (.xlsx, .csv only) and size validation (max 5MB)
    - Group selector for target group
    - Progress indicator during upload/processing
    - Summary modal showing import results (inserted, updated, skipped, errors)
    - _Requirements: 7.5, 7.6, 7.7_

  - [ ] 12.2 Add contact selection to campaign form
    - Add "Select from Contact Database" option in campaign recipient input
    - Show group multi-select when this option is chosen
    - Call `/api/wa/campaigns/{id}/recipients/from-contacts` with selected group IDs
    - Show count of contacts that will be added
    - _Requirements: 6.1, 6.4_

- [ ] 13. Frontend: Route registration and navigation
  - [ ] 13.1 Register page route and add sidebar navigation
    - Add route `/dashboard/admin/wa/contacts` → `AdminWaContactsPage`
    - Add navigation item in admin sidebar under WA Blast section
    - Ensure proper role-based visibility (Admin, WaAdmin, WaOperator)
    - _Requirements: 7.1_

- [ ] 14. Final checkpoint - Ensure full application compiles and all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The import route needs a separate body limit layer (5MB) similar to existing upload routes
- `rust_xlsxwriter` is a new dependency; `calamine` and `proptest` are already available
