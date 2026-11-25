# Fixtures

Captured from a run of this example against the Toolpath API on a 45.72 mm cube, for the tests to
replay without an API key.

- `part.json`: the analyzed part (`GET /v1/parts/{id}`).
- `plan-queued.json`: the answer to its first `POST /v1/parts/{id}/plans`, echoing the plan spec sent.
- `plan.json`: that plan (`GET /v1/plans/{planId}`).
- `mesh.glb`: the mesh the part's regions index into.

Ids are replaced with `00000000-…` ones, and storage URLs with `storage.example.com` paths that
serve nothing: the tests answer them.
