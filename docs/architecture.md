# QuickNotes Service Architecture

## Functional requirements

- Users authenticate and create, read, update, and delete only their own notes.
- Users can list notes newest first, paginate results, and filter notes by tag.
- A note has a required title of 1-100 characters and an optional body; users can create tags and assign them to notes.
- The browser client displays request progress, success, empty, and error states and validates a note title before sending it.

## Non-functional requirements

- **Availability:** Keep note reads and writes available through an app-server or worker instance failure, and recover from a database primary failure.
- **Performance:** Target a p95 response below 300 ms for cached reads and below 500 ms for normal note writes, excluding client network time.
- **Consistency:** A successful note write is committed durably on the database primary before returning `201` or `200`; replica reads may briefly lag.
- **Security:** Require TLS and authenticated, owner-scoped queries; encrypt stored data and avoid caching private note bodies in a shared CDN cache.
- **Durability and recovery:** Back up the primary database, test restore procedures, and retain durable queue messages until successfully processed.
- **Scalability:** Scale stateless app servers and workers horizontally; add database read capacity through a read replica and cache without routing writes away from the primary.

## Load estimate for 1 million users

Assumptions for a simple planning baseline:

- There are `1,000,000` registered users; `20%` use the app each day, so daily active users (DAU) are `200,000`.
- Each active user makes `10` note-list/detail reads and creates or updates `1` note per day.
- Each newly written note averages `10 KB` of stored title, body, and row metadata; the estimate excludes indexes, replicas, backups, tags, and logs.
- Requests are averaged over `86,400` seconds per day; peak load is estimated at `5x` the average. Storage accumulates for `365` days.

| Measure | Calculation | Estimate |
| --- | --- | ---: |
| Average reads per second | `200,000 DAU x 10 reads / 86,400` | `23.1 reads/s` |
| Peak reads per second | `23.1 x 5` | `115.7 reads/s` (about 116) |
| Average writes per second | `200,000 DAU x 1 write / 86,400` | `2.3 writes/s` |
| Peak writes per second | `2.3 x 5` | `11.6 writes/s` |
| New notes per year | `200,000 x 1 x 365` | `73,000,000 notes` |
| Note storage per year | `73,000,000 x 10 KB` | `730,000,000 KB` = `730 GB` (decimal) |

These are average planning estimates, not capacity limits; launch telemetry should replace the assumptions and inform headroom, retention, and replica sizing.

## Architecture diagram

```text
                            +-----------------------+
                            | DNS (redundant)       |
                            +-----------+-----------+
                                        |
                  +---------------------+---------------------+
                  |                                           |
                  v                                           v
          +---------------+                         +----------------+
          | CDN           |                         | Load balancer  |
          | static client |                         | health checks  |
          +-------+-------+                         +-------+--------+
                  |                                           |
                  | static app                                +-----------------+
                  |                                           |                 |
                  v                                           v                 v
             +---------+                               +-------------+   +-------------+
             | Client  | -- API over TLS ------------>| App server A|   | App server B|
             +---------+                               | zone A      |   | zone B      |
                                                     +-+----+----+-+   +-+----+----+-+
                                                       |    |    |       |    |    |
                                        cache read/write    |    +-------+    |    |
                                                       v    |                 |    |
                                                +------------+                 |    |
                                                | Cache      |<----------------+    |
                                                | HA cluster |                      |
                                                +------------+                      |
                                                       |                             |
                                       cache miss read |                             |
                                                       v                             |
                                           +----------------------+                 |
                         writes ---------->| Primary database     |                 |
                                           | zone A               |                 |
                                           +----------+-----------+                 |
                                                      | asynchronous replication   |
                                                      v                             |
                                           +----------------------+                 |
                    read-only queries ---->| Database read replica|<----------------+
                                           | zone B               |
                                           +----------------------+

                  app servers -- durable note events --> +----------------+
                                                        | Replicated queue|
                                                        +-------+--------+
                                                                |
                                                                v
                                                       +------------------+
                                                       | Worker pool      |
                                                       | search indexing, |
                                                       | cache invalidation|
                                                       +------------------+
```

Private note APIs bypass shared CDN object caching; the CDN serves the static browser client and may cache only explicitly safe public assets. The cache uses user-scoped keys, and the read replica serves only queries where brief replication lag is acceptable.

## Component responsibilities

- **Client:** Provides the browser interface for composing notes and making authenticated API requests.
- **DNS:** Resolves the service hostname to redundant edge and API entry points so clients can locate the service.
- **CDN:** Delivers static client assets from nearby edge locations, reducing latency and origin traffic without exposing private note bodies to shared caches.
- **Load balancer:** Routes API traffic to healthy app servers and removes failed instances from rotation.
- **App servers (A and B):** Authenticate requests, enforce note ownership and validation, coordinate database transactions, and enqueue asynchronous work.
- **Cache:** Stores frequently requested user-scoped note-list results to reduce repeated read load on the database.
- **Primary database:** Durably stores users, notes, tags, and note-tag relationships and handles all writes.
- **Database read replica:** Serves eligible read-only note queries to increase read capacity while replication copies committed primary changes.
- **Replicated queue:** Persists asynchronous events and separates the successful API response from slower secondary work.
- **Worker pool:** Processes queued search-index and cache-invalidation tasks and retries transient failures without blocking note creation.

## `GET /notes` flow

1. The client resolves the API hostname through DNS and sends an authenticated `GET /v1/notes` request over TLS to the load-balanced API.
2. The load balancer selects a healthy app server; the app validates the token and scopes the query to that user's ID.
3. The app checks the cache using a key that includes the user ID and pagination/filter parameters; it never uses a shared key for private notes.
4. On a cache hit, the app returns the cached page; on a miss, it queries the read replica for the user's notes, populates the cache with a short TTL, and returns the page and cursor.
5. If the replica is unavailable, the app can fall back to the primary for reads while healthy; if the cache is unavailable, it bypasses the cache and queries the database.

## `POST /notes` flow

1. The client sends an authenticated `POST /v1/notes` with a JSON title, optional body, and optional tag names over TLS.
2. The load balancer selects a healthy app server, which validates the token, checks title length and request shape, and verifies tag ownership.
3. In a database transaction, the app inserts the note and its tag links into the primary database; the primary commit is the success boundary.
4. After commit, the app publishes a note-created event to the durable queue and invalidates the affected user's cached note lists.
5. The API returns `201 Created` with the new note; the worker later processes the event for search indexing and retries transient failures independently.

## Trade-offs and single-point-of-failure prevention

- **Read replicas and caches increase read capacity but can be stale.** The UI can briefly lag after a write; write responses come from the primary, cache TTLs stay short, and user-scoped keys are invalidated on change. A replica failure triggers read fallback to the primary while operators restore replication.
- **Asynchronous workers improve write latency but delay secondary effects.** Note creation succeeds before search indexing finishes, so the product must tolerate a short indexing delay; durable queue messages, retries, dead-letter handling, and worker monitoring prevent silent loss.
- **More replicas improve availability but add cost and operational complexity.** Two or more stateless app servers run across zones behind a health-checking load balancer; the database has automated primary failover to a read replica plus tested backups; the queue and cache run as redundant clusters; and workers run as a replaceable pool. DNS and CDN are managed redundant services, so no single application instance is required for the service to operate.