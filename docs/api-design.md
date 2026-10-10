# QuickNotes REST API

Base URL: `https://api.quicknotes.example/v1`  
Authentication: send a bearer access token in `Authorization: Bearer <token>` for all user-specific routes. The API returns JSON unless the status is `204 No Content`.

## Endpoints

| Method | Path | Description | Success |
| --- | --- | --- | --- |
| `GET` | `/notes?limit=20&cursor={cursor}` | List the authenticated user's notes, newest first; returns a cursor for the next page. | `200 OK` |
| `GET` | `/notes/{noteId}` | Retrieve one note owned by the authenticated user. | `200 OK` |
| `POST` | `/notes` | Create a note for the authenticated user. | `201 Created` |
| `PATCH` | `/notes/{noteId}` | Update one or more supplied fields on a note. | `200 OK` |
| `DELETE` | `/notes/{noteId}` | Delete a note owned by the authenticated user. | `204 No Content` |
| `GET` | `/notes?tag={tagName}` | List the authenticated user's notes with the specified tag; supports the same pagination parameters. | `200 OK` |
| `PUT` | `/notes/{noteId}/tags` | Replace the complete set of tags assigned to a note. | `200 OK` |

All note and tag lookups are scoped to the authenticated user. A resource belonging to another user is reported as `404 Not Found`, so the API does not disclose that user's data exists.

## List notes example

Request:

```http
GET /v1/notes?limit=2 HTTP/1.1
Host: api.quicknotes.example
Authorization: Bearer eyJhbGciOi...
Accept: application/json
```

Response `200 OK`:

```json
{
  "data": [
    {
      "id": "note_8f31",
      "title": "Plan the launch",
      "body": "Confirm the release checklist with the team.",
      "tags": ["work", "planning"],
      "createdAt": "2026-10-11T09:30:00Z",
      "updatedAt": "2026-10-11T09:30:00Z"
    },
    {
      "id": "note_71ac",
      "title": "Book a room",
      "body": "Reserve the small meeting room for Tuesday.",
      "tags": [],
      "createdAt": "2026-10-10T15:05:00Z",
      "updatedAt": "2026-10-10T15:05:00Z"
    }
  ],
  "page": {
    "nextCursor": "eyJpZCI6Im5vdGVfNzFhYyJ9"
  }
}
```

When there are no matching notes, `data` is an empty array and `nextCursor` is `null`.

## Create note example

Request:

```http
POST /v1/notes HTTP/1.1
Host: api.quicknotes.example
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json
```

```json
{
  "title": "Plan the launch",
  "body": "Confirm the release checklist with the team.",
  "tags": ["work", "planning"]
}
```

Response `201 Created`:

```json
{
  "data": {
    "id": "note_8f31",
    "title": "Plan the launch",
    "body": "Confirm the release checklist with the team.",
    "tags": ["work", "planning"],
    "createdAt": "2026-10-11T09:30:00Z",
    "updatedAt": "2026-10-11T09:30:00Z"
  }
}
```

## Error responses

Errors use a consistent JSON envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title must contain between 1 and 100 characters.",
    "details": [{ "field": "title", "issue": "length" }]
  }
}
```

| Status | Meaning and example |
| --- | --- |
| `400 Bad Request` | Malformed JSON, missing title, title over 100 characters, or invalid tag IDs. |
| `401 Unauthorized` | Missing, expired, or invalid bearer token. |
| `403 Forbidden` | Authenticated user lacks permission for an administrative action, such as deleting a shared workspace. |
| `404 Not Found` | Note or tag does not exist, or is not visible to the authenticated user. |
| `500 Internal Server Error` | Unexpected database or service failure; the response does not expose stack traces or secrets. |

The error envelope above is an example `400` response. For example, requesting a note that is not found returns `404` with `{"error":{"code":"NOT_FOUND","message":"Note not found."}}`.