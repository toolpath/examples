# Fixtures

Copied from `@toolpath/viewer`'s test fixtures
(https://github.com/toolpath/ui-packages/tree/main/packages/viewer/fixtures), which the
published package does not ship.

- `reports/local-0.3.0-cube.json`: a sanitized Engine part report for a cube: 24 features
  over 6 regions from 4 candidate directions. Its URLs are test-only and their presigned
  query strings are redacted, so do not use them for anything.
- `mesh/local-0.3.0-cube.glb`: the mesh that report's region ranges index into.
- `mesh/stock-box.json`: two base64 GLB stock blanks, for the example's GLB stock option.
