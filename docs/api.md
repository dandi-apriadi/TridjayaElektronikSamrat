# API Specification

## 1. Design Principles

- RESTful and consistent.
- Clear resource naming.
- Stable response schema.
- Input validation at the boundary.
- No secret leakage in errors.
- All sensitive endpoints require authentication.

## 2. Common Response Format

```json
{
  "success": true,
  "message": "OK",
  "data": {},
  "meta": {}
}
```

For errors:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": []
}
```

## 3. Auth Endpoints

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/refresh`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

Security rules:

- rate limit login attempts,
- use short-lived access tokens,
- rotate refresh tokens,
- return generic errors for auth failure.

## 4. User Endpoints

- `GET /api/users`
- `POST /api/users`
- `GET /api/users/{id}`
- `PATCH /api/users/{id}`
- `DELETE /api/users/{id}`

Rules:

- admin only for sensitive operations,
- role changes must be audited,
- self-service update must be scoped.

## 5. Catalog Endpoints

- `GET /api/catalogs`
- `POST /api/catalogs`
- `GET /api/catalogs/{id}`
- `PATCH /api/catalogs/{id}`
- `DELETE /api/catalogs/{id}`

Rules:

- validate price and numeric fields,
- sanitize rich text fields,
- restrict image upload format,
- require publish permission.

## 6. Promotion Endpoints

- `GET /api/promotions`
- `POST /api/promotions`
- `PATCH /api/promotions/{id}`
- `DELETE /api/promotions/{id}`

Rules:

- check start and end dates,
- prevent invalid discount values,
- record audit history.

## 7. Referral Endpoints

- `POST /api/referrals/generate`
- `GET /api/referrals`
- `GET /api/referrals/{slug}`
- `GET /api/referrals/{slug}/stats`

Rules:

- slug must be generated server-side,
- only authorized agents can create their own referral links,
- stats must be filtered by role and scope.

## 8. Telemetry Endpoints

- `POST /api/telemetry/page-view`
- `POST /api/telemetry/click`
- `POST /api/telemetry/whatsapp-click`
- `POST /api/telemetry/pixel-event`

Rules:

- reject malformed event payloads,
- deduplicate repeated events,
- limit event spam,
- do not accept arbitrary event names from the client without mapping.

## 9. Job and Content Endpoints

- `GET /api/jobs`
- `POST /api/jobs`
- `PATCH /api/jobs/{id}`
- `GET /api/articles`
- `POST /api/articles`
- `PATCH /api/articles/{id}`

Rules:

- draft and publish states must be enforced,
- only authorized roles can publish,
- content must pass sanitization before storage or render.

## 10. Error Handling

- 400 for validation errors.
- 401 for unauthenticated requests.
- 403 for unauthorized access.
- 404 for missing resource.
- 409 for conflict.
- 429 for rate limiting.
- 500 for unexpected internal failure.

Error messages must be concise and should not reveal internal stack traces.
