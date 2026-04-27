# Research: Pitfalls for v1.1

**Research Date:** 2026-04-27
**Milestone:** v1.1 — Production Maturity & Scalability
**Dimension:** Pitfalls

---

## Pitfall 1: Sharp in Serverless (High Risk)

**Problem:** Sharp uses native bindings (libvips). Vercel serverless has restrictions on binary sizes and native modules.

**Warning Signs:**
- Build succeeds but runtime fails with "Cannot find module"
- Cold start increases from ~500ms to ~3s
- Function size exceeds Vercel's 50MB limit

**Prevention:**
- Test `npm run build` then deploy to Vercel preview immediately
- Use `sharp` in `dependencies` (not devDependencies)
- Consider `jimp` as fallback if Sharp fails in serverless

**Which Phase Should Address It:** Image Resize phase — include Vercel deployment test in success criteria

---

## Pitfall 2: Cache Stampede (Medium Risk)

**Problem:** When cache expires, multiple concurrent requests hit the DB simultaneously.

**Scenario:**
1. 100 users open app at 9:00 AM
2. All request categories
3. Cache TTL expires at exactly 9:00:00
4. 100 concurrent DB queries for categories

**Warning Signs:**
- DB connection pool exhaustion
- Spikes in latency at regular intervals (TTL boundaries)

**Prevention:**
- Use cache warming (background refresh before TTL)
- Or implement probabilistic early expiration (refresh at 80% of TTL)
- For v1.1: acceptable to accept stampede risk — categories table is small

**Which Phase Should Address It:** Redis Caching phase — document stampede risk, implement if time permits

---

## Pitfall 3: Apple OAuth Key Management (High Risk)

**Problem:** Apple requires a JWT client secret signed with a private key. Key rotation is manual.

**Warning Signs:**
- "invalid_client" errors from Apple
- Users can't sign in suddenly
- Key expires every 6 months (Apple requirement)

**Prevention:**
- Store private key in env var (not in code)
- Document key rotation process
- Better Auth may auto-rotate — verify this
- Add monitoring for Apple auth failure rate

**Which Phase Should Address It:** Apple OAuth phase — include key rotation documentation

---

## Pitfall 4: API Versioning Breaking Mobile Apps (Medium Risk)

**Problem:** Adding `/api/v1/` breaks existing mobile apps that call `/api/`.

**Scenario:**
1. Deploy API versioning
2. Mobile app (v1.0) still calls `/api/transactions`
3. Returns 404
4. App crashes for all existing users

**Prevention:**
- Keep unversioned routes working (backward compatible)
- Add `/api/v1/` alongside `/api/`
- Mobile app migrates in a subsequent release
- Only deprecate unversioned after 100% mobile adoption

**Which Phase Should Address It:** API Versioning phase — dual-route support is mandatory

---

## Pitfall 5: AsyncLocalStorage Memory Leaks (Medium Risk)

**Problem:** If AsyncLocalStorage store isn't cleaned up, memory grows with each request.

**Warning Signs:**
- Memory usage grows over time (Vercel Function OOM)
- "AsyncLocalStorage store not empty" warnings

**Prevention:**
- Use NestJS interceptor pattern (automatic cleanup)
- Don't store large objects in ALS
- Test with load (artillery or k6)

**Which Phase Should Address It:** Request ID phase — interceptor-based implementation

---

## Pitfall 6: Graceful Shutdown + Cached Server (Medium Risk)

**Problem:** Vercel's cached server pattern complicates graceful shutdown.

**Scenario:**
1. First request boots server (cached)
2. Server stays warm
3. Vercel sends SIGTERM during idle
4. Cached server reference prevents clean shutdown
5. Next request uses stale server instance

**Prevention:**
- Track in-flight requests with a counter
- On SIGTERM: set shuttingDown flag, wait for counter = 0
- Clear cachedServer reference
- Vercel will create new instance on next request

**Which Phase Should Address It:** Graceful Shutdown phase — test with Vercel preview

---

## Pitfall 7: Redis Connection Leaks (Low Risk)

**Problem:** Each request might create a new Redis connection.

**Prevention:**
- `getRedisClient()` is already a singleton
- Verify this pattern is maintained for cache client

**Which Phase Should Address It:** Redis Caching phase — verify singleton pattern

---

## Pitfall 8: Image Resize Blocking Event Loop (Medium Risk)

**Problem:** Sharp operations are CPU-intensive and can block the event loop.

**Warning Signs:**
- Other requests timeout during image processing
- Event loop lag spikes

**Prevention:**
- Use Sharp's `toBuffer()` (async)
- Limit concurrent image processing (1 at a time)
- Consider streaming instead of buffering entire image

**Which Phase Should Address It:** Image Resize phase — include concurrent processing limit

---

## Pitfall 9: Over-Engineering Request Context (Low Risk)

**Problem:** Storing too much in AsyncLocalStorage makes debugging hard.

**Prevention:**
- Store only: request-id, user-id (optional), start time
- Don't store: full request object, response object, large DTOs

**Which Phase Should Address It:** Request ID phase — keep context minimal

---

## Summary: Risk Matrix

| Pitfall | Likelihood | Impact | Phase |
|---------|-----------|--------|-------|
| Sharp in serverless | Medium | High | Image Resize |
| Cache stampede | Medium | Medium | Redis Caching |
| Apple OAuth keys | High | High | Apple OAuth |
| Versioning breaks mobile | High | High | API Versioning |
| ALS memory leaks | Low | Medium | Request ID |
| Shutdown + cached server | Medium | Medium | Graceful Shutdown |
| Redis connection leaks | Low | Low | Redis Caching |
| Image blocks event loop | Medium | Medium | Image Resize |
| Over-engineering context | Low | Low | Request ID |
