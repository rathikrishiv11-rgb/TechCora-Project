# Phase 3 verification

Verified against the project Neon database on 2026-10-06. No database credential is stored in this repository.

## Full-data reads

- Dashboard renders aggregate totals and bounded recent/low-stock lists.
- Invoice list returns 25 rows per page and supports server-side search and whitelisted sorting.
- Movement report returns 25 rows per page and supports server-side search.
- Material search returns at most 20 aggregate rows for the selected location; positive batches are a separate on-demand request.
- Production smoke responses returned HTTP 200 for all pages and APIs.

## Invoice transaction and idempotency

The smoke invoice `phase3-smoke-20261006` consumed `0.0001` units. Batch stock changed from `86.0000` to `85.9999`. Repeating the identical request returned `replayed: true` and did not consume stock again.

Each invoice transaction:

1. checks a client-generated request ID and payload fingerprint;
2. takes deterministic material/location advisory locks;
3. locks positive FIFO batches with `FOR UPDATE`;
4. rejects the complete invoice if any requested quantity is unavailable;
5. writes the invoice, lines, allocations, movements, batch changes, location summaries, and daily dashboard summary;
6. commits all changes together.

## Concurrent sale proof

Two requests were sent concurrently for two units each of material `1761726623773`, with three units available in Warehouse A.

| Request | Result |
| --- | --- |
| `phase3-race-b-20261006` | HTTP 201; two units allocated |
| `phase3-race-a-20261006` | HTTP 409; available quantity reported as one |

Final positive batch quantity: `1.0000`. There was no negative stock and no partial invoice from the rejected request.

## Sixty-line receipt proof

Receipt `phase3-receipt-60-20261006` committed with exactly 60 receipt lines. Its receipt lines, 60 new batches, inbound movements, and per-location stock-summary increments use one database transaction and the same material/location advisory-lock protocol as invoice allocation.

## Quality gates

- ESLint: passed
- TypeScript: passed
- Vitest: 5 tests passed
- Next.js production build: passed
- All masked-export counts had already reconciled during Phase 2 import
