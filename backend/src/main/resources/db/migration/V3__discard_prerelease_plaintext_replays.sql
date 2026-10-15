-- The unpublished local prototype stored plaintext replay responses. Retain no such cache
-- through the first encrypted release; business records and authenticated envelopes remain.
DELETE FROM idempotency_records WHERE response NOT LIKE 'v1.%';
