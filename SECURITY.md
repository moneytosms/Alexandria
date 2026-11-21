# Security Policy

## Local-First Privacy Guarantee

**Alexandria** is built from the ground up as a local-first desktop application:

- **Zero Telemetry:** The Electron desktop app never sends analytics, crash dumps, reading history, or document metadata to any external server.
- **Process Isolation:** The renderer runs with Electron `contextIsolation: true`, strict Content Security Policy (CSP), and explicit `contextBridge` APIs (`src/preload/index.ts`).
- **Path Traversal Protection:** File reads, cover/thumbnail serving, audio streaming, and deletion operations validate normalized paths strictly inside the configured library or user-selected music directories.
- **Cryptographic Release Verification:** Every automated release publishes a `SHA256SUMS.txt` checksum manifest so users can verify installer integrity before execution.

---

## Supported Versions

Security fixes are applied to the latest rolling release on `main` and the most recent tagged `v*` release:

| Version | Supported |
| :--- | :--- |
| Latest (`main` / newest `v*` tag) | Supported |
| Older pre-release snapshots | Unsupported — please upgrade to the latest release |

---

## Reporting a Vulnerability

If you discover a security vulnerability—such as an IPC privilege escalation, path traversal, XSS/CSP bypass, or unsafe PDF/Office document handling—please **do not** open a public GitHub issue.

Instead, report it privately via one of the following channels:

1. **GitHub Private Vulnerability Reporting** (preferred): Open the **Security** tab on the Alexandria GitHub repository and select **Report a vulnerability**.
2. **Direct Maintainer Email:** Email the project maintainer listed in `package.json` with the subject prefix `[SECURITY] Alexandria: <short summary>`.

Please include:

- A clear description of the vulnerability and its potential impact
- Step-by-step reproduction instructions or a minimal proof-of-concept file
- Your operating system, Electron/Node version, and Alexandria build version

### Response Timeline

- **Acknowledgement:** Within 72 hours of receiving your report
- **Assessment & Remediation:** We will work with you to validate the issue, develop a fix, and coordinate responsible public disclosure once patched binaries are published.
