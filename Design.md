# Mini Airbnb Design

## Current stage

V1 core booking flow has passed the local booking, validation, concurrent-request and application-restart checks. Git setup and the V1 baseline commit are pending user action. V2 implementation is pending.

Checkpoint saved on 20 November 2026.

| Version | Scope | Current status |
| --- | --- | --- |
| V1 | Single-night booking | Core tests passed. Date representation follow-ups recorded below. Git baseline pending. |
| V2 | Listings, multi-night booking and availability search | Planned |
| V3 | Temporary holds, expiry, simulated checkout and cancellation | Planned |
| V4 | Shared rate limiting, caching and app replicas | Planned |
| V5 | Redis Streams booking notifications and workers | Planned |
| V6 | Kafka comparison and end-to-end release | Planned |

The six-version learning sequence is in VERSION_PLAN.md. This document records the implemented state and test evidence.

## Requirements and decisions

- Build an API-first hotel/property booking system and learn each design decision through implementation and tests.
- Start with two seeded guests, IDs 101 and 102, and one seeded property, ID 501.
- Property 501 uses the Asia/Kolkata timezone.
- A guest can book one night from tomorrow onward, based on the property's local calendar date.
- Guest and property IDs must identify existing records.
- One property can have at most one booking for a particular night.
- Confirmed bookings remain stored after the application restarts.
- API responses use English messages.
- PostgreSQL is the primary database. Relationships, foreign keys, uniqueness and transactional growth informed this choice. PostGIS is planned for a future geospatial search requirement.
- CAP partition behavior is a later replicated-system learning exercise. Its implementation remains pending.

## High-level design

```text
Thunder Client / test script
        |
        | POST /bookings
        v
Node.js + Express API :8000
        |
        v
Booking route -> booking service -> repositories -> PostgreSQL
        ^                                            |
        |____________ saved row or error ____________|
```

| File | Responsibility |
| --- | --- |
| server.js | Parse JSON, register routes, expose health, check DB connectivity, and start the HTTP server |
| config/db.js | Load local connection settings and export one shared pg Pool |
| routes/bookingRoutes.js | Read request fields, call the service, and map results/errors to HTTP responses |
| services/bookingServices.js | Validate IDs and dates, look up guest/property, apply the timezone rule, and request the insert |
| repositories/userRepository.js | Look up a guest by ID and return a row or null |
| repositories/propertyRepository.js | Look up a property, including its timezone, and return a row or null |
| repositories/bookingRepository.js | Insert using parameters, return the saved row, and propagate database errors |
| testlookup.js | Manually exercise guest and property lookups |
| testConcurrentBookings.js | Send two booking requests together and assert the stored result |

The layout follows the root-level config, routes, services and repositories organization used during the earlier learning project.

## API contract

### Health

GET /health returns HTTP 200 with {"status":"ok"}. The startup check runs SELECT 1 before listening. The health handler itself reports HTTP responsiveness.

### Create a booking

POST /bookings accepts JSON:

```json
{
  "user_id": 101,
  "property_id": 501,
  "check_in_date": "2026-12-12"
}
```

| Outcome | HTTP status |
| --- | --- |
| Booking inserted | 201 with a booking object containing the inserted row |
| Invalid ID, invalid date, today or an earlier date | 400 |
| Unknown guest or property | 404 |
| PostgreSQL unique violation, code 23505 | 409 with "This night is already booked" |
| Unexpected failure | 500 with "Could not create booking" |

The current success response comes from INSERT ... RETURNING * and includes booking_id, user_id, property_id, check_in_date and created_at. Date representation needs the follow-up recorded below.

## PostgreSQL schema

Columns and constraints were inspected directly through read-only metadata queries on 20 November 2026.

| Table | Column | Verified definition |
| --- | --- | --- |
| public.users | user_id | INTEGER PRIMARY KEY |
| public.properties | property_id | INTEGER PRIMARY KEY |
| public.properties | timezone | TEXT NOT NULL |
| public.bookings | booking_id | INTEGER identity, PRIMARY KEY |
| public.bookings | user_id | INTEGER NOT NULL, foreign key to users.user_id |
| public.bookings | property_id | INTEGER NOT NULL, foreign key to properties.property_id |
| public.bookings | check_in_date | DATE NOT NULL |
| public.bookings | created_at | TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP |

The unique constraint bookings_property_id_check_in_date_key enforces UNIQUE (property_id, check_in_date).

### Booking and concurrency flow

1. Validate positive integer IDs within the PostgreSQL INTEGER range.
2. Require YYYY-MM-DD and reject impossible calendar dates.
3. Look up the guest and property. Missing records produce an application error.
4. Compute today's date in the property's timezone and require check_in_date to be later.
5. Execute one parameterized INSERT with $1, $2 and $3.
6. PostgreSQL enforces the unique property/night pair while concurrent writes compete.
7. The successful insert returns its row after the statement commits. The competing unique violation reaches the route and becomes HTTP 409.

V1 uses the single insert's implicit transaction. V2 will define an explicit transaction boundary for an entire stay.

## Verified results

| Check | Result and evidence |
| --- | --- |
| Guest 101 lookup | User pasted { user_id: 101 } |
| Unknown guest 999 lookup | User pasted null |
| Property 501 lookup | User pasted property_id 501 and timezone Asia/Kolkata |
| First booking followed by repeated request | User reported 201 followed by 409 |
| Unknown guest and property | User confirmed the guided 404 cases |
| Impossible date and past date | User confirmed the guided 400 cases |
| Two concurrent requests for property 501 on 2026-12-13 | User pasted guest 101 receiving 201 and guest 102 receiving 409 |
| Stored result of that concurrency test | Script assertions passed for exactly one row belonging to the successful guest |
| Application restart and duplicate request | User reported 409 after restarting the API |
| Source verification for this checkpoint | Agent syntax-checked all 9 JavaScript files and inspected database columns and constraints |

Runtime booking results above come from the user's runs. The agent's checkpoint inspection covered source syntax, schema metadata and a read-only date-serialization probe. The concurrency fixture contains one pair of requests on one API instance. Broader contention and outage coverage belong to later tests.

## Follow-ups before the V2 baseline

- Make check_in_date a YYYY-MM-DD string in the API response. A read-only probe through the current pg setup serialized PostgreSQL DATE '2026-12-13' as "2026-12-12T18:30:00.000Z". The current raw RETURNING row exposes that timestamp representation.
- Review created_at storage. The live column is TIMESTAMP WITHOUT TIME ZONE. The earlier proposed TIMESTAMPTZ requires a deliberate migration that accounts for how existing timestamps were written.
- Save the verified schema and seed setup as SQL files so a fresh database can reproduce V1. SQL migration files are pending.
- Set up the Git repository and ignore local credentials and node_modules before the baseline commit.
- The concurrency script requires an unused future property/night pair. Its successful test booking stays saved. Reusing that pair yields two conflicts.
- npm test is the package placeholder. Current checks are run using the individual scripts.

## V2 working agreement

1. User initializes Git and records the reviewed V1 baseline on main.
2. Create the codex/v2-bookings branch from that baseline.
3. Decide the multi-night model, checkout-exclusive date range, transaction boundary, search fields and indexes before implementing each part.
4. Preserve V1 data through an explicit schema migration.
5. Verify adjacent stays, overlapping stays, last-night failure rollback and full-stay availability search. Re-run V1 behavior checks.
6. Update these design notes and review the diff and test output.
7. Merge the tested V2 branch into main after review.

The next implementation checkpoint is the V1 follow-up list, followed by the V2 design discussion.
