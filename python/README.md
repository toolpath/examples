# Python part analysis

This command uses the `toolpath` Python SDK to create a part, upload a STEP file, start analysis,
listen until the report is ready, fetch feature datasheets, and print the complete report as JSON.
`wait_for_job` follows the job's event stream for progress rather than polling.

Install [Python 3.11 or newer](https://www.python.org/downloads/) and
[uv](https://docs.astral.sh/uv/getting-started/installation/). The SDK is not on PyPI: uv installs
the wheel attached to its
[GitHub release](https://github.com/toolpath/ui-packages/releases?q=python-sdk), pinned in
`pyproject.toml`. Run the commands below from the repository root, replacing the example API key
and file path with your own values.

Windows PowerShell:

```powershell
$env:TOOLPATH_API_KEY = "your-api-key"
uv run --project python python python/src/analyze_part.py "C:\path\to\part.step"
```

Windows Command Prompt:

```batch
set TOOLPATH_API_KEY=your-api-key
uv run --project python python python/src/analyze_part.py "C:\path\to\part.step"
```

macOS or Linux:

```bash
TOOLPATH_API_KEY="your-api-key" uv run --project python python python/src/analyze_part.py "/path/to/part.step"
```

The final output is the complete report returned by the API:

```text
Analysis started as job 0195f02d-...
Analyzing geometry...
{
  "partId": "0195f02c-...",
  "jobId": "0195f02d-...",
  "features": []
}
```
