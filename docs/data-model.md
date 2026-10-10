# QuickNotes Data Model

## Entities and relationships

- **users** stores account identity, a unique email address, and account creation time.
- **notes** stores a user's title, optional body, and creation/update timestamps. Each note belongs to one user; one user can own many notes, a one-to-many relationship.
- **tags** stores labels owned by a user. One user can create many tags, also a one-to-many relationship.
- **note_tags** links notes and tags. A note can have many tags and each tag can label many notes, so notes and tags have a many-to-many relationship. The join table stores each note-tag pair and uses a composite primary key to prevent duplicate assignments.

The application must verify that a tag and note belong to the same user before creating a `note_tags` row; the API scopes both lookups to the authenticated account.

## SQLite schema

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  user_id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notes (
  note_id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 100),
  body TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

CREATE TABLE tags (
  tag_id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 50),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
  UNIQUE (user_id, name)
);

CREATE TABLE note_tags (
  note_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (note_id, tag_id),
  FOREIGN KEY (note_id) REFERENCES notes (note_id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags (tag_id) ON DELETE CASCADE
);

CREATE INDEX idx_notes_user_updated
  ON notes (user_id, updated_at DESC);
```

The `idx_notes_user_updated` index supports the common query that lists one user's notes newest-updated first, avoiding a scan and sort across every account's notes. The unique `(user_id, email)` constraint is indexed by SQLite automatically, as is the `note_tags` composite primary key.

## Example queries

List the newest notes for one user (the API supplies the authenticated `user_id`):

```sql
SELECT note_id, title, body, created_at, updated_at
FROM notes
WHERE user_id = ?
ORDER BY updated_at DESC
LIMIT ?;
```

Find notes with their tags using a join across the many-to-many relationship:

```sql
SELECT n.note_id, n.title, t.name AS tag
FROM notes AS n
JOIN note_tags AS nt ON nt.note_id = n.note_id
JOIN tags AS t ON t.tag_id = nt.tag_id
WHERE n.user_id = ?
ORDER BY n.note_id, t.name;
```

Count notes per tag for one user, including tags with no notes:

```sql
SELECT t.name, COUNT(nt.note_id) AS note_count
FROM tags AS t
LEFT JOIN note_tags AS nt ON nt.tag_id = t.tag_id
WHERE t.user_id = ?
GROUP BY t.tag_id, t.name
ORDER BY t.name;
```

## SQL or NoSQL?

I would use SQL for QuickNotes. Notes have clear ownership and tags have explicit many-to-many relationships; foreign keys, uniqueness constraints, and transactions protect those invariants. The service also needs predictable filtered, sorted, paginated queries and joins, which a relational database expresses directly. A read replica and cache can scale reads without giving up relational integrity.