# SOP-003: Schema Design & Version Control

**Version:** 1.0
**Effective Date:** Q2 FY2026
**Owner:** EEB Data Engineering Team
**Review Cycle:** Quarterly

---

## Purpose

This SOP establishes standards and procedures for designing, registering, versioning, and evolving schemas for Enterprise Event Bus (EEB) Kafka topics. Proper schema management ensures:
- Data contract clarity between producers and consumers
- Backward and forward compatibility during evolution
- Type safety and validation at ingestion time
- Self-documenting data structures
- Automated compatibility testing

---

## Scope

This procedure covers:
- Schema design principles and best practices
- Schema registry integration and subject naming
- Compatibility modes and evolution rules
- Version management and breaking change handling
- Schema validation and testing processes
- Documentation requirements

---

## Schema Fundamentals

### What is a Schema?

A schema defines the structure, types, and constraints of data in a Kafka topic. For EEB, we use **Apache Avro** as the primary schema format.

**Benefits of Schema Registry:**
- Centralized schema storage and versioning
- Automatic compatibility checking
- Smaller message sizes (schema not embedded)
- Client code generation from schema
- Prevention of incompatible data writes

---

## Schema Design Principles

### Principle 1: Design for Evolution

**DO:** Design schemas that can evolve without breaking consumers

```json
{
  "type": "record",
  "name": "CustomerEvent",
  "namespace": "com.company.crm",
  "fields": [
    {"name": "customer_id", "type": "string"},
    {"name": "event_type", "type": "string"},
    {"name": "timestamp", "type": "long", "logicalType": "timestamp-millis"},
    {"name": "email", "type": ["null", "string"], "default": null}
  ]
}
```

**Key Points:**
- Optional fields have union type with `null` and default value
- Required fields (`customer_id`, `event_type`, `timestamp`) don't have defaults
- Timestamp uses logical type for clarity
- Namespace prevents naming collisions

**DON'T:** Design rigid schemas that can't accommodate future needs

```json
{
  "type": "record",
  "name": "CustomerEvent",
  "fields": [
    {"name": "id", "type": "string"},
    {"name": "type", "type": "string"}
  ]
}
```

**Problems:**
- Field names too generic (`id`, `type`)
- No timestamp (can't order events)
- No optional fields (can't add data later)
- No namespace (collision risk)

---

### Principle 2: Use Descriptive Field Names

**DO:**
```json
{
  "fields": [
    {"name": "customer_uuid", "type": "string", "doc": "Unique customer identifier"},
    {"name": "account_creation_date", "type": "long", "logicalType": "timestamp-millis"},
    {"name": "email_address", "type": ["null", "string"], "default": null},
    {"name": "is_active", "type": "boolean", "default": true}
  ]
}
```

**DON'T:**
```json
{
  "fields": [
    {"name": "id", "type": "string"},
    {"name": "dt", "type": "long"},
    {"name": "em", "type": "string"},
    {"name": "flg", "type": "boolean"}
  ]
}
```

**Guidelines:**
- Use `snake_case` for field names (Avro convention)
- Spell out words (no abbreviations like `dt`, `em`, `flg`)
- Boolean fields start with `is_`, `has_`, `should_`
- Include units in names: `timeout_seconds`, `amount_usd`, `size_bytes`

---

### Principle 3: Document Every Field

**DO:**
```json
{
  "type": "record",
  "name": "TransactionEvent",
  "doc": "Core banking transaction events from mainframe CDC",
  "fields": [
    {
      "name": "transaction_id",
      "type": "string",
      "doc": "Unique transaction identifier from source system. Format: TXN-{timestamp}-{sequence}"
    },
    {
      "name": "amount_usd",
      "type": "double",
      "doc": "Transaction amount in USD. Positive for credits, negative for debits."
    },
    {
      "name": "transaction_type",
      "type": {
        "type": "enum",
        "name": "TransactionType",
        "doc": "Type of banking transaction",
        "symbols": ["DEPOSIT", "WITHDRAWAL", "TRANSFER", "FEE", "INTEREST"]
      },
      "doc": "Category of transaction"
    }
  ]
}
```

**Benefits:**
- Consumers understand field purpose without reading code
- Documents valid values and formats
- Explains units and sign conventions
- Generated documentation from schema

---

### Principle 4: Use Appropriate Data Types

**Avro Type Selection Guide:**

| Data | Avro Type | Logical Type | Example |
|------|-----------|--------------|---------|
| **Text** | `string` | - | `"John Doe"` |
| **Integer (small)** | `int` | - | `42` (-2B to 2B) |
| **Integer (large)** | `long` | - | `9876543210` |
| **Decimal** | `double` | - | `123.45` |
| **Boolean** | `boolean` | - | `true`, `false` |
| **Timestamp** | `long` | `timestamp-millis` | `1614556800000` |
| **Date** | `int` | `date` | `18000` (days since epoch) |
| **UUID** | `string` | `uuid` | `"550e8400-e29b-41d4-a716-446655440000"` |
| **Money** | `bytes` | `decimal` | Precise monetary amounts |
| **Binary Data** | `bytes` | - | Encrypted data, images |
| **Complex Object** | `record` | - | Nested structure |
| **List** | `array` | - | `["item1", "item2"]` |
| **Key-Value Map** | `map` | - | `{"key": "value"}` |
| **Enumeration** | `enum` | - | Predefined set of values |
| **Optional Field** | `["null", "type"]` | - | Can be missing |

**Real-World Example:**

```json
{
  "type": "record",
  "name": "PaymentEvent",
  "namespace": "com.company.payments",
  "doc": "Payment processing events",
  "fields": [
    {
      "name": "payment_id",
      "type": "string",
      "logicalType": "uuid",
      "doc": "Unique payment identifier"
    },
    {
      "name": "amount",
      "type": {
        "type": "bytes",
        "logicalType": "decimal",
        "precision": 10,
        "scale": 2
      },
      "doc": "Payment amount with 2 decimal precision"
    },
    {
      "name": "currency_code",
      "type": {
        "type": "enum",
        "name": "CurrencyCode",
        "symbols": ["USD", "EUR", "GBP", "JPY"]
      },
      "doc": "ISO 4217 currency code"
    },
    {
      "name": "payment_method",
      "type": {
        "type": "enum",
        "name": "PaymentMethod",
        "symbols": ["CREDIT_CARD", "DEBIT_CARD", "BANK_TRANSFER", "PAYPAL"]
      }
    },
    {
      "name": "created_at",
      "type": "long",
      "logicalType": "timestamp-millis",
      "doc": "Payment creation timestamp in milliseconds since Unix epoch"
    },
    {
      "name": "metadata",
      "type": ["null", {"type": "map", "values": "string"}],
      "default": null,
      "doc": "Optional key-value metadata"
    }
  ]
}
```

---

## Schema Registry Integration

### Subject Naming Convention

For each topic, register schema using this pattern:

```
{topic-name}-value
```

**Examples:**
```
Topic: eeb.banking.transactions.v1
Subject: eeb.banking.transactions.v1-value

Topic: eeb.crm.customer-events.v2
Subject: eeb.crm.customer-events.v2-value
```

**Why `-value` suffix?**
- Kafka messages have key and value
- Most EEB topics only schema the value (not the key)
- Subject naming convention separates key vs value schemas

**Key Schemas (Less Common):**
If you schema the message key:
```
Subject: eeb.banking.transactions.v1-key
```

---

### Registering a Schema

**Process:**

1. **Design schema** following principles above
2. **Save schema** as `.avsc` file in version control:
   ```
   schemas/
     eeb.banking.transactions.v1.avsc
     eeb.crm.customer-events.v2.avsc
   ```
3. **Register in Schema Registry** via Confluent Cloud UI or API
4. **Record subject name** in EEB dashboard topic detail
5. **Generate client code** from schema (optional)

**Manual Registration (Confluent Cloud UI):**

1. Navigate to Schema Registry in Confluent Cloud
2. Click **"Add Schema"**
3. Enter subject name: `eeb.banking.transactions.v1-value`
4. Paste Avro schema JSON
5. Click **"Create"**
6. Note schema ID returned (e.g., `12345`)

**API Registration (Automated):**

```bash
curl -X POST \
  https://schema-registry-url/subjects/eeb.banking.transactions.v1-value/versions \
  -H "Content-Type: application/vnd.schemaregistry.v1+json" \
  -d '{"schema": "{\"type\":\"record\",\"name\":\"Transaction\",...}"}'
```

**Dashboard Integration:**

After registration, update topic record in dashboard:

```
Topic: eeb.banking.transactions.v1
Schema Registry Subject: eeb.banking.transactions.v1-value
Schema ID: 12345
Schema Version: 1
```

Attach schema file to topic in dashboard document library.

---

## Compatibility Modes

Schema Registry enforces compatibility rules to prevent breaking changes.

### Compatibility Types

| Mode | Allows | Use Case |
|------|--------|----------|
| **BACKWARD** | Deleting fields, adding optional fields | Default for most topics |
| **FORWARD** | Adding fields, deleting optional fields | Producer evolves faster than consumers |
| **FULL** | Only adding/deleting optional fields | Both producer and consumer can evolve |
| **BACKWARD_TRANSITIVE** | BACKWARD rules for all versions | Strictest backward compatibility |
| **FORWARD_TRANSITIVE** | FORWARD rules for all versions | Strictest forward compatibility |
| **FULL_TRANSITIVE** | FULL rules for all versions | Maximum compatibility guarantee |
| **NONE** | Any change allowed | Dangerous - use only for testing |

**EEB Standard:** Use `BACKWARD` compatibility for production topics

---

### Backward Compatibility Rules

**Backward compatible** = New schema can read old data

**Allowed Changes:**
- ✓ Add optional field with default value
- ✓ Delete field (consumers will ignore missing field)
- ✓ Change field documentation

**Prohibited Changes:**
- ✗ Add required field (old data doesn't have it)
- ✗ Remove required field (new consumers expect it)
- ✗ Change field type (int → string)
- ✗ Rename field (breaks consumers)
- ✗ Change field order (breaks some serializers)

**Real-World Example:**

**Schema v1:**
```json
{
  "type": "record",
  "name": "UserEvent",
  "fields": [
    {"name": "user_id", "type": "string"},
    {"name": "event_type", "type": "string"}
  ]
}
```

**Schema v2 (BACKWARD COMPATIBLE):**
```json
{
  "type": "record",
  "name": "UserEvent",
  "fields": [
    {"name": "user_id", "type": "string"},
    {"name": "event_type", "type": "string"},
    {"name": "ip_address", "type": ["null", "string"], "default": null}
  ]
}
```

✓ **Compatible** because:
- New field `ip_address` is optional (union with null)
- Has default value (`null`)
- Old messages (without `ip_address`) can be read with new schema

**Schema v2 (NOT BACKWARD COMPATIBLE):**
```json
{
  "type": "record",
  "name": "UserEvent",
  "fields": [
    {"name": "user_id", "type": "string"},
    {"name": "event_type", "type": "string"},
    {"name": "ip_address", "type": "string"}
  ]
}
```

✗ **NOT Compatible** because:
- New field `ip_address` is required (no default)
- Old messages don't have `ip_address` field
- Reading old data with new schema will fail

---

## Schema Evolution

### Non-Breaking Evolution (Version Increment)

For backward-compatible changes, increment schema version in registry:

**Process:**
1. Modify schema following backward compatibility rules
2. Register new version in Schema Registry (same subject)
3. Schema Registry auto-assigns version 2, 3, etc.
4. Update producers to use new schema version
5. Consumers automatically handle both versions

**Example Evolution:**

```
eeb.banking.transactions.v1-value (subject)
  ├─ Schema Version 1: Initial schema (5 fields)
  ├─ Schema Version 2: Added optional field email (6 fields)
  └─ Schema Version 3: Added optional field phone (7 fields)
```

**Dashboard Tracking:**
```
Topic: eeb.banking.transactions.v1
Schema Registry Subject: eeb.banking.transactions.v1-value
Schema Version: 3 (latest)
Schema History:
  - v1 (Oct 2025): Initial schema
  - v2 (Nov 2025): Added optional email field
  - v3 (Jan 2026): Added optional phone field
```

---

### Breaking Evolution (Topic Version Increment)

For non-backward-compatible changes, create new topic:

**Process:**
1. Create new topic: `eeb.banking.transactions.v2`
2. Register new schema: `eeb.banking.transactions.v2-value`
3. Deploy dual-write: Produce to both v1 and v2
4. Migrate consumers from v1 to v2
5. Deprecate v1 after migration period
6. Delete v1 topic

**Breaking Change Examples:**

**Scenario:** Rename field `user_id` → `customer_uuid`

```
Old topic: eeb.crm.customer-events.v1
Old schema (v1-value):
  {
    "fields": [
      {"name": "user_id", "type": "string"},
      ...
    ]
  }

New topic: eeb.crm.customer-events.v2
New schema (v2-value):
  {
    "fields": [
      {"name": "customer_uuid", "type": "string"},
      ...
    ]
  }
```

**Migration Plan:**
```
Week 1: Create v2 topic, register v2 schema
Week 2: Deploy producer dual-write (v1 + v2)
Week 3-8: Migrate consumers to v2 (test each)
Week 9: Monitor v1 consumer lag (should be zero)
Week 10: Stop writing to v1, deprecate
Week 14: Delete v1 topic
```

---

## Schema Design Patterns

### Pattern 1: Event Envelope

Wrap event data in standard envelope with metadata:

```json
{
  "type": "record",
  "name": "EventEnvelope",
  "namespace": "com.company.eeb",
  "fields": [
    {
      "name": "event_id",
      "type": "string",
      "logicalType": "uuid",
      "doc": "Unique event identifier"
    },
    {
      "name": "event_type",
      "type": "string",
      "doc": "Type of event (e.g., 'user.created', 'transaction.processed')"
    },
    {
      "name": "event_time",
      "type": "long",
      "logicalType": "timestamp-millis",
      "doc": "Time event occurred in source system"
    },
    {
      "name": "source_system",
      "type": "string",
      "doc": "System that generated this event"
    },
    {
      "name": "correlation_id",
      "type": ["null", "string"],
      "default": null,
      "doc": "Optional correlation ID for tracing across systems"
    },
    {
      "name": "payload",
      "type": {
        "type": "record",
        "name": "UserCreatedPayload",
        "fields": [
          {"name": "user_id", "type": "string"},
          {"name": "email", "type": "string"},
          {"name": "created_at", "type": "long", "logicalType": "timestamp-millis"}
        ]
      },
      "doc": "Event-specific payload"
    }
  ]
}
```

**Benefits:**
- Consistent metadata across all events
- Easy filtering by event_type
- Built-in tracing with correlation_id
- Timestamp for event ordering

---

### Pattern 2: Change Data Capture (CDC)

For database change capture topics:

```json
{
  "type": "record",
  "name": "CDCEvent",
  "namespace": "com.company.banking.cdc",
  "fields": [
    {
      "name": "operation",
      "type": {
        "type": "enum",
        "name": "Operation",
        "symbols": ["CREATE", "UPDATE", "DELETE"]
      },
      "doc": "Type of database operation"
    },
    {
      "name": "timestamp",
      "type": "long",
      "logicalType": "timestamp-millis",
      "doc": "Time of database change"
    },
    {
      "name": "before",
      "type": ["null", {
        "type": "record",
        "name": "TransactionRecord",
        "fields": [
          {"name": "id", "type": "string"},
          {"name": "amount", "type": "double"},
          {"name": "status", "type": "string"}
        ]
      }],
      "default": null,
      "doc": "Record state before change (null for CREATE)"
    },
    {
      "name": "after",
      "type": ["null", "TransactionRecord"],
      "default": null,
      "doc": "Record state after change (null for DELETE)"
    }
  ]
}
```

**Use Case:** Capture all changes to `transactions` table

**Pattern Benefits:**
- Consumers can see what changed (before vs after)
- Supports all CRUD operations
- Maintains audit trail

---

### Pattern 3: Versioned Payload

Allow multiple payload versions in same topic:

```json
{
  "type": "record",
  "name": "VersionedEvent",
  "fields": [
    {
      "name": "schema_version",
      "type": "int",
      "doc": "Schema version of payload (1, 2, 3...)"
    },
    {
      "name": "payload",
      "type": [
        {
          "type": "record",
          "name": "PayloadV1",
          "fields": [
            {"name": "user_id", "type": "string"}
          ]
        },
        {
          "type": "record",
          "name": "PayloadV2",
          "fields": [
            {"name": "user_id", "type": "string"},
            {"name": "email", "type": "string"}
          ]
        }
      ],
      "doc": "Union of all payload versions"
    }
  ]
}
```

**Use Case:** When you need to support multiple schema versions simultaneously without separate topics

**Caution:** This pattern is complex and should be avoided unless absolutely necessary. Prefer separate topics (v1, v2) for breaking changes.

---

## Schema Validation & Testing

### Pre-Registration Validation

Before registering schema:

**Checklist:**
- [ ] All fields have descriptive names (no abbreviations)
- [ ] All fields have documentation
- [ ] Appropriate data types selected
- [ ] Optional fields have defaults
- [ ] Enums documented with all valid values
- [ ] Namespace matches company standards
- [ ] Logical types used where appropriate
- [ ] Schema parses without errors

**Validation Tools:**

**Online Validator:**
Use Avro tools to validate syntax:
```bash
java -jar avro-tools.jar compile schema eeb.banking.transactions.v1.avsc .
```

**Dashboard Upload:**
Upload `.avsc` file to topic document library for team review before registration.

---

### Compatibility Testing

Before registering new schema version:

**Test Process:**
1. Generate sample old data using schema v1
2. Attempt to deserialize using schema v2
3. Verify all fields readable
4. Check default values applied correctly

**Confluent Schema Registry Test:**
```bash
# Test compatibility before registering
curl -X POST \
  https://schema-registry-url/compatibility/subjects/eeb.banking.transactions.v1-value/versions/latest \
  -H "Content-Type: application/vnd.schemaregistry.v1+json" \
  -d '{"schema": "{NEW_SCHEMA_JSON}"}'

# Response:
{"is_compatible": true}  # or false with error details
```

If `is_compatible: false`, fix schema before registering.

---

## Documentation Requirements

### Schema Documentation Artifacts

For each topic schema, maintain:

1. **Schema File** (`.avsc`)
   - Store in version control
   - Include full documentation
   - Attach to topic in dashboard

2. **Schema Changelog**
   - Document each schema version
   - Explain what changed and why
   - Note migration considerations

3. **Sample Messages**
   - Provide example JSON messages
   - Cover common and edge cases
   - Help consumers understand structure

4. **Consumer Guide**
   - Language-specific examples
   - Deserialization code samples
   - Error handling patterns

**Example Changelog:**

```markdown
# eeb.banking.transactions.v1 Schema Changelog

## Schema Version 3 (Jan 2026)
**Changes:**
- Added optional field `merchant_category_code` (string)
- Added optional field `is_international` (boolean, default: false)

**Rationale:**
Support fraud detection use case requiring merchant category and international transaction flag.

**Migration:**
Backward compatible. Old messages will have null/false defaults for new fields.

**Sample Message:**
{
  "transaction_id": "TXN-1640995200000-12345",
  "amount_usd": 49.99,
  "merchant_category_code": "5411",  // NEW
  "is_international": false          // NEW
}
```

---

## Common Pitfalls

### Pitfall 1: Changing Field Type

```json
// Schema v1
{"name": "amount", "type": "int"}

// Schema v2 - WRONG!
{"name": "amount", "type": "double"}
```

**Problem:** Type change breaks compatibility
**Solution:** Add new field with different name, deprecate old field
```json
// Schema v2 - CORRECT
{"name": "amount", "type": "int"},
{"name": "amount_precise", "type": "double", "default": 0.0}
```

---

### Pitfall 2: Required Field Without Default

```json
// Schema v2 - WRONG!
{"name": "new_field", "type": "string"}
```

**Problem:** Old messages don't have this field
**Solution:** Make optional with default
```json
// Schema v2 - CORRECT
{"name": "new_field", "type": ["null", "string"], "default": null}
```

---

### Pitfall 3: Renaming Fields

```json
// Schema v1
{"name": "user_id", "type": "string"}

// Schema v2 - WRONG!
{"name": "customer_id", "type": "string"}
```

**Problem:** Consumers looking for `user_id` won't find it
**Solution:** Create new topic version (eeb.topic.v2) or keep both fields
```json
// Schema v2 - WORKAROUND (if new topic not feasible)
{"name": "user_id", "type": "string", "doc": "DEPRECATED - use customer_id"},
{"name": "customer_id", "type": ["null", "string"], "default": null}
```

---

### Pitfall 4: Enum Evolution

```json
// Schema v1
{"name": "status", "type": {"type": "enum", "name": "Status", "symbols": ["ACTIVE", "INACTIVE"]}}

// Schema v2 - WRONG!
{"name": "status", "type": {"type": "enum", "name": "Status", "symbols": ["ACTIVE", "CLOSED"]}}
```

**Problem:** Changed enum values break consumers expecting "INACTIVE"
**Solution:** Only add new enum values, never remove or rename
```json
// Schema v2 - CORRECT
{"name": "status", "type": {"type": "enum", "name": "Status", "symbols": ["ACTIVE", "INACTIVE", "CLOSED"]}}
```

---

## Related SOPs

- **SOP-001:** Topic Discovery & Registration
- **SOP-002:** Naming Convention Validation
- **SOP-004:** Cost Modeling & ROM Generation
- **SOP-005:** Environment Promotion Workflow
- **SOP-006:** Incident Management & Escalation

---

## Quick Reference

**Schema Registry Subject Pattern:**
```
{topic-name}-value
```

**Default Compatibility Mode:**
```
BACKWARD (new schema can read old data)
```

**Backward Compatible Changes:**
- ✓ Add optional field with default
- ✓ Delete field
- ✓ Add enum value

**Breaking Changes (Require New Topic):**
- ✗ Add required field
- ✗ Change field type
- ✗ Rename field
- ✗ Remove enum value

**Best Practices:**
- Document every field
- Use logical types for timestamps, UUIDs
- Make new fields optional with defaults
- Test compatibility before registering
- Store schemas in version control
- Attach schema to topic in dashboard

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Q2 FY2026 | Data Engineering Team | Initial release |

---

## Approval

**Reviewed by:**
- [ ] Senior Data Engineer
- [ ] EEB Platform Lead
- [ ] Data Governance Committee

**Approved by:** _________________________  Date: __________

---

**Questions or Feedback:** Contact EEB Data Engineering Team or submit via dashboard feedback system.
