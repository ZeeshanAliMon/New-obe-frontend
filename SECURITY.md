# Security Policy and Tradeoffs

This document outlines the security architecture, known design tradeoffs, and recommended hardening steps for the **Iqra University OBE System**.

## 1. Authentication & Token Storage

### Current Architecture
Currently, the application uses JWT-based authentication (access and refresh tokens). These tokens are stored in the client-side `localStorage`:
- `localStorage.setItem('access', ...)`
- `localStorage.setItem('refresh', ...)`

### Known Tradeoff (Risk of XSS)
Storing session tokens in `localStorage` makes them accessible to client-side JavaScript. In the event of a Cross-Site Scripting (XSS) vulnerability or a compromised npm supply-chain dependency, an attacker could potentially extract these tokens.

### Production Hardening Recommendation
To mitigate this risk:
1. **httpOnly Cookies**: The backend should be updated to issue JWT tokens via secure, `httpOnly` cookies instead of raw JSON payloads. This completely prevents access to tokens via `window.localStorage` or document scripts, shielding the system against token theft via XSS.
2. **SameSite Attribute**: Ensure the cookie uses `SameSite=Strict` or `SameSite=Lax` with `Secure` flags in production to protect against Cross-Site Request Forgery (CSRF).

---

## 2. Default Password & Credential Management

### Default Password Policy
To ensure that default credentials do not remain vulnerable:
- A secure temporary default password constant (`DEFAULT_TEMP_PASSWORD`) is defined globally in `/src/utils/config.ts`.
- When an account is created with this temporary password, the application prompts the user with a mandatory **Change Password Flow** on their first login before allowing access to any core features.
- Authenticated requests are intercepted and blocked if a password change is pending.

---

## 3. Storage Offline Fallbacks

### LocalStorage caching
`localStorage` is used as a caching mechanism. To prevent silent local modifications when a real server is expected, the application now displays a highly visible **Offline Sandbox Mode** warning banner at the top of the viewport whenever connection is lost, warning the user that their data is stored only in the browser cache.
