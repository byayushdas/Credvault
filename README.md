# CredVault – Decentralized Credential Vault

**Project Title:** CredVault – Decentralized Credential Vault  
**Prepared By:** Team Innovators  
**Team Members:** Ayush Das, Arpan Ghosh, Prajuktika Mondal, Triparna Das  
**Version:** 1.0  

# 1. Introduction

## 1.1 Purpose

CredVault is a **privacy-preserving digital credential platform** that securely stores, issues, and verifies credentials. It gives the **Owner control over data sharing** and supports **selective disclosure** instead of exposing complete documents.

## 1.2 Scope

CredVault supports:

- **Owner, Issuer, and Verifier** roles
- **Secure authentication** and role-based access
- Personal **Vault ID** and **QR code** for Owners
- **QR-based credential issuance** by authorized Issuers
- **QR-based verification requests** by Verifiers
- Government and educational credential types
- **AES-256-GCM encrypted** credential/attachment storage
- **Ed25519 digital signatures** and integrity verification
- **Auto-Approve, Ask, and Deny** consent rules
- **Selective disclosure** of requested fields
- Credential **revocation**
- **Append-only audit logging**
- Live updates using **SSE** where supported

## 1.3 Definitions

- **Owner:** Person who owns the credential vault.
- **Issuer:** Authorized organization that issues credentials.
- **Verifier:** Authorized organization that requests credential information.
- **Vault ID:** Unique identifier of an Owner's vault.
- **QR Code:** QR representation of the Owner's vault reference.
- **Selective Disclosure:** Sharing only requested and authorized fields.
- **Consent Rule:** Owner-defined sharing policy: **AUTO-APPROVE, ASK, DENY**.
- **Issuer Registry:** Trusted issuer organizations and signing keys.
- **RBAC:** Role-Based Access Control.

## 1.4 References

- **CredVault Project Report – Decentralized Credential Vault**
- Current **CredVault source repository** and implementation
- **IEEE 830 SRS guidelines**

## 1.5 Overview

The system connects three actors through a secure backend:

**Owner → Vault → Issuer / Verifier**

Core flow:

**Authentication → Vault → Credential → Consent Engine → Selective Disclosure → Audit**

# 2. Overall Description

## 2.1 Product Description

CredVault is a **React/Vite + FastAPI + PostgreSQL** web application. The platform uses an **Issuer Registry**, encrypted credential storage, cryptographic signatures, consent rules, QR-based vault identification, verification requests, and audit controls to provide user-controlled credential verification.

## 2.2 Product Functions

- **User registration, login, logout, and password management**
- **Owner Vault ID** generation and QR display
- **Credential issuance** directly to an Owner vault
- **Credential drafts, storage, viewing, and revocation**
- Support for **education, government, employment, healthcare, identity, and general** credential schemas
- **Verifier vault confirmation** through QR or Vault ID
- Field-level **verification requests** with stated purpose and lifetime
- **Consent evaluation** for every requested field
- **Auto-approval, pending approval, and denial** workflows
- **Digital signature and credential integrity verification**
- **Audit events**, notifications, and live revision updates
- **Temporary verification/share tokens**

## 2.3 User Classes

### Owner

Manages the vault, credentials, **Vault ID/QR**, consent rules, verification requests, approvals/denials, and audit history.

### Issuer

An approved organization that can **issue, digitally sign, store, and revoke credentials** for Owners.

### Verifier

An approved organization that can **identify an Owner vault, request specific fields, and view permitted verification results**.

## 2.4 Operating Environment

- **Frontend:** React 19, TypeScript, Vite 8
- **Backend:** Python 3.12, FastAPI
- **Database:** PostgreSQL
- **ORM/Migration:** SQLAlchemy, Alembic
- **QR:** `qrcode.react`, `html5-qrcode`
- **Security:** Argon2 password hashing, secure HttpOnly sessions, CSRF/origin checks, AES-256-GCM, Ed25519
- **Communication:** REST APIs and authenticated SSE

## 2.5 Design Constraints

- **Backend-enforced authorization**; frontend role checks are not trusted for security.
- Every Owner must have a **unique, opaque Vault ID**.
- QR codes must contain a **safe vault/share reference only**.
- Scanning a QR must **not automatically grant document access**.
- Verifiers must request **specific credential fields**.
- The **Consent Engine** controls disclosure.
- Credential and attachment data must remain **encrypted**.
- Audit records are designed to be **append-only and integrity-protected**.
- Prototype government credentials use **demo/fictitious data**.
- The current system is **not blockchain-based** and does not implement full zero-knowledge proofs.

## 2.6 Assumptions

- Users have access to a supported browser and network.
- Issuers and Verifiers are authenticated and approved before trusted operations.
- QR scanning requires a camera-enabled device; manual Vault ID entry is also supported.
- PostgreSQL and required backend/frontend services are available.
- Demo credentials and test data are fictional and used only for development/testing.

# 3. Specific Requirements

## 3.1 Functional Requirements

**FR1 – Authentication:** System shall authenticate users and enforce **Owner/Issuer/Verifier RBAC**.

**FR2 – Owner Vault:** System shall create a secure vault and **unique Vault ID** for each Owner.

**FR3 – QR Identification:** System shall generate an Owner **QR code** and allow authorized Issuers/Verifiers to scan it or enter the Vault ID.

**FR4 – Credential Issuance:** Approved Issuers shall create, **sign, encrypt, and store** credentials in the selected Owner vault.

**FR5 – Credential Management:** Owners shall view credentials; Issuers shall manage credentials they issued and may **revoke** them.

**FR6 – Consent Rules:** Owners shall configure **AUTO-APPROVE, ASK, and DENY** rules for credential fields.

**FR7 – Verification Requests:** Verifiers shall request a selected credential and **specific fields**, with a stated purpose and request lifetime.

**FR8 – Selective Disclosure:** System shall disclose **only approved requested fields** and keep unrelated fields private.

**FR9 – Owner Decision:** Owners shall **approve or deny** pending requests requiring manual consent.

**FR10 – Verification:** System shall verify **issuer trust, digital signatures, credential status, and integrity** before disclosure.

**FR11 – Audit:** System shall record **issuance, requests, decisions, disclosures, revocation, and relevant QR/security actions**.

**FR12 – Notifications/Live Updates:** Authorized users shall receive request/credential updates through notifications and supported **SSE** events.

**FR13 – Temporary Sharing:** System shall support **time-limited share tokens/QR references** for controlled verification flows.

## 3.2 External Interface Requirements

### 3.2.1 User Interface

- **Owner Portal:** Dashboard, My Documents, QR/Vault ID, Consent Rules, Verification Requests, Audit Log
- **Issuer Portal:** Dashboard, Scan/Enter Vault ID, Issue Document, Issued Documents, Registry, Revoke
- **Verifier Portal:** Dashboard, Scan/Enter Vault ID, New Verification, Request History, Results

### 3.2.2 Hardware Interface

- Desktop/laptop
- Smartphone/tablet
- **Camera** for QR scanning

### 3.2.3 Software Interface

- React/Vite frontend
- FastAPI REST backend
- PostgreSQL database
- QR generation/scanning libraries
- Cryptographic and storage services

### 3.2.4 Communication Interface

- **REST API**
- Secure browser session/cookie communication
- **SSE** for live authorized updates
- OAuth-based verifier API access where configured

## 3.3 Non-Functional Requirements

### 3.3.1 Performance

- Normal verification requests should target approximately **under 2 seconds** under the intended local workload.
- QR identification and normal API actions should provide responsive feedback.

### 3.3.2 Security

- **AES-256-GCM** encryption for protected stored data
- **Ed25519** digital signatures for issuer credentials
- **Secure HttpOnly sessions**
- **CSRF and origin protection**
- **RBAC and object-level authorization**
- Protected local storage with no direct public document exposure
- No sensitive credential values in normal audit/live-event payloads

### 3.3.3 Privacy

- **Owner-controlled disclosure**
- **Minimum-field sharing**
- QR identifies a vault but does not itself authorize access
- Verifiers cannot receive the Owner's complete vault or unrelated fields
- Consent configuration remains protected

### 3.3.4 Reliability and Maintainability

- Modular **frontend/backend services**
- Database migrations using **Alembic**
- Input validation and controlled error responses
- Automated and browser-level testing for core workflows
- Audit integrity checks and transaction-based updates

# 4. Appendices

## A. Glossary

- **Vault:** Secure digital storage area owned by a user.
- **Vault ID:** Unique identifier for an Owner vault.
- **Credential:** Digitally issued document/data record.
- **Issuer Registry:** Trusted issuer and signing-key registry.
- **Consent Engine:** Evaluates whether requested information may be shared.
- **Selective Disclosure:** Disclosure of only permitted fields.
- **Audit Log:** Record of important security and credential actions.
- **Revocation:** Invalidating an issued credential.
- **SSE:** Server-Sent Events for live updates.

## B. Future Scope

- **Official government and university integrations**
- **Mobile application** with integrated QR scanning
- **Verifiable Credentials / Decentralized Identifiers (DID)**
- **Zero-Knowledge Proofs** for claims such as age eligibility
- **Cloud deployment** and scalable distributed storage
- Advanced **MFA/security keys**
- Broader **credential interoperability** standards
