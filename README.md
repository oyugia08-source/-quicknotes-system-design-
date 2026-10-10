# QuickNotes System Design

QuickNotes is a browser client prototype and backend system design for a notes service planned to support one million registered users. The client uses JSONPlaceholder to demonstrate GET, POST, and DELETE requests; the accompanying documents describe the real API, relational data model, and scalable service architecture.

## Run the API client

The client is plain HTML, CSS, and JavaScript with no build step. From the repository root, start a local static server:

```sh
python -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000) in a browser and select **Load notes**. An internet connection is needed to reach JSONPlaceholder. Its practice API acknowledges POST and DELETE requests but does not persist those changes, so created and deleted notes are reflected only in the current page session.

## Design documents

- [REST API design](docs/api-design.md)
- [Data model](docs/data-model.md)
- [Architecture and scaling plan](docs/architecture.md)

## What I learned

- A reusable request helper can centralize HTTP error checks, while each UI action still owns its loading, success, failure, and disabled-button states.
- A relational join table makes the many-to-many note-tag relationship explicit and allows the database to prevent duplicate assignments.
- Capacity estimates depend on assumptions: daily activity, read/write frequency, item size, and peak multipliers should be stated so measured production traffic can replace them.
- Caches and read replicas improve read capacity, but introduce staleness and failover behavior that the product and operations plan must account for.