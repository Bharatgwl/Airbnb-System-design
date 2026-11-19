# Mini Airbnb | Six-version system design roadmap

Ek API-first booking system. Har version pichhle version par build hoga. V6 tak host listing publish karega, guest location aur dates se search karega, hold aur simulated checkout se book karega, booking cancel kar sakega, aur inbox mein booking updates dekh sakega. API responses English mein hongi. UI ki zaroorat padne par minimal UI ka scope decide karenge.

## Har version ka workflow

1. Problem, requirements, expected traffic aur acceptance cases likho.
2. HLD mein components aur request flow draw karo. LLD mein API, data model, constraints aur failure behavior decide karo.
3. Kaam ko chhote testable tasks mein baanto. Ek task implement karo, output verify karo, phir next task lo.
4. Git mein reviewable commits rakho. Version close karte waqt test evidence, ek trade-off aur next version ki wajah likho. Passing commit ko version tag do.

Design aur implementation tum karoge. Review mein gaps, failure cases aur trade-offs discuss honge.

| Version | Milestone | Main concepts |
| --- | --- | --- |
| V1 | Single-night booking | Data modeling, atomic write, durability, concurrency, Git |
| V2 | Listings, multi-night booking, search | Transactions, isolation, rollback, indexing, pagination |
| V3 | Holds, checkout, cancellation | State transitions, expiry, idempotency, timeouts and retries |
| V4 | Traffic, caching, replicas | Token bucket, Redis, cache-aside, load balancing, observability |
| V5 | Async booking notifications | Transactional outbox, Redis Streams, worker queues, backpressure, deduplication |
| V6 | Kafka and end-to-end release | Partitioning, replication, offsets, replay, CAP failure exercise, deployment |

## V1 · Single-night booking

- **Build.** Start with one preloaded listing and two test guests. Book one night from tomorrow onward in the property's timezone. Return clear failures for invalid dates, unknown guests or listings, and an occupied night. Confirm only after the booking is saved.
- **Decide in HLD/LLD.** Review the existing Client → Booking API → Persistent Storage flow. Choose where the system enforces one booking per listing per night when requests overlap. Compare database candidates on atomic writes, durability, V2 transaction needs, query patterns and local setup.
- **Apply CAP.** For a future replicated setup, decide what each operation can do during a network partition. If a node cannot safely confirm a booking, that write must fail or wait. Define whether search can serve stale information and for how long. Use that trade-off and the workload to guide the DB choice. [Gilbert and Lynch on CAP](https://groups.csail.mit.edu/tds/papers/Gilbert/Brewer6.pdf)
- **Finish line.** Two simultaneous requests for the same listing and night produce one success and one conflict. Storage has one booking for the winning guest. After app restart, the booking persists and the same night still conflicts.

## V2 · Listings, multi-night booking and search

- **Build.** A test host can publish a listing with basic location data. Guests search by location and full-stay availability. Support check-in through the night before checkout.
- **Decide in HLD/LLD.** Model listings, bookings and reserved nights. Choose the transaction boundary, isolation behavior, index strategy and stable search pagination. Keep the V1 booking guarantee.
- **Finish line.** Adjacent stays work. Overlaps fail. A conflict on the last night rolls back the earlier night claims. Search returns listings available for the full stay. Compare the search query plan and timing on the same seeded dataset before and after indexing.

## V3 · Holds, checkout and cancellation

- **Build.** Add temporary holds, simulated checkout, expiry and cancellation. Release inventory when an eligible booking is cancelled or a hold expires.
- **Decide in HLD/LLD.** Draw the state transitions. Define which transition wins when expiry and checkout race. Scope and store idempotency keys so retrying the same checkout can recover its outcome, and reusing a key with different input fails clearly.
- **Finish line.** An expired hold cannot confirm and its nights can be booked again. Simulate a lost response after successful checkout. Retrying with the same key yields the same confirmation and one saved booking. Cancellation releases the nights.

## V4 · Traffic, caching and app replicas

- **Build.** Establish a load baseline. Apply a token bucket to hold creation, first in one process and then with shared, atomic Redis updates across two API instances. Put both instances behind a load balancer. Add cache-aside for listing details or catalog reads where the baseline shows repeat traffic.
- **Decide in HLD/LLD.** Set refill rate, burst size, cache TTL and invalidation. Define Redis outage behavior for limiting and reads. Booking and hold writes keep the authoritative inventory check. Record request IDs, latency, error rates and cache hits.
- **Finish line.** A burst split across replicas hits one shared limit, returns HTTP 429 when tokens run out, and succeeds after refill. A stale cache cannot cause double booking. Verify documented behavior with a stopped API instance and unavailable Redis. Record before/after p95 latency and DB query counts under the same workload.

## V5 · Async booking notifications

- **Build.** Deliver confirmation and cancellation notifications to a local inbox. Use this flow to separate booking writes from notification work and let workers catch up after a temporary failure. Start with Redis Streams when introducing the queue.
- **Decide in HLD/LLD.** Save the booking change and outbox event in one transaction. A relay publishes with a stable event ID. Workers save the inbox result before acknowledging, deduplicate redelivery, and send jobs that exhaust bounded retries to a dead-letter stream. Track backlog and choose worker concurrency, retention and backpressure behavior. [Redis Streams documentation](https://redis.io/docs/latest/develop/data-types/streams/)
- **Finish line.** Booking stays usable during a worker outage. The inbox catches up on recovery. A crash after saving but before ACK can redeliver without creating two notifications. A repeatedly failing job reaches the dead-letter stream, and a broker outage leaves relay work recoverable from the outbox.

## V6 · Kafka comparison and end-to-end release

- **Build.** Run the same notification flow with Kafka after the Redis Streams baseline. Use the same event IDs and idempotent consumer behavior. Set up a repeatable local deployment, API role and ownership checks for hosts and guests, a Git-based verification pipeline, structured logs, and basic operational metrics.
- **Decide in HLD/LLD.** Choose the event key and partition strategy, ordering needs, retention, consumer groups and offset commit point. Exercise the CAP policy in an isolated replicated setup or simulation. Record booking and search behavior on each side of a partition and after recovery. Document how to restore booking data and roll back the release. [Apache Kafka design documentation](https://kafka.apache.org/40/design/design/)
- **Finish line.** Run publish → search → hold → checkout → notification → cancellation → available again. Prove one booking under contention, replay without duplicate inbox entries, and restore booking data from a backup. Compare Redis Streams and Kafka on the same workload for recovery, replay, consumer lag, and operational effort.

## Current checkpoint

V1 requirements and the first HLD request flow are drafted. Next design decision is where the booking invariant should live. The database and its concrete concurrency mechanism are open.
