# Incident Data Import Guide

## Date & Time Handling

When importing incidents from the Excel file, the system needs to use the **Date & Time** column for accurate incident timestamps.

### Current Behavior

- Incidents are currently created with `created_at` timestamp from when they're added to the database
- The Excel file contains a "Date & Time" column with the actual incident occurrence time (e.g., "1/12/26 10:07 PM")

### How to Update Incident Dates

#### Option 1: Update Excel Import Component

The Excel import component should map the "Date & Time" column to the `created_at` field when creating alerts.

In `src/components/ExcelImport.tsx`, when processing rows:

```typescript
// Convert Date & Time string to ISO format
const dateTimeStr = row['Date & Time'];
const incidentDate = new Date(dateTimeStr).toISOString();

await alertsService.create({
  incident_number: row['Incident ID'],
  title: `${row['Incident ID']}: ${row['Alert Name']}`,
  priority: getPriority(row),
  severity: getSeverity(row),
  business_service: 'Enterprise Event Broker',
  category: 'Application',
  subcategory: row['Alert Name'],
  created_at: incidentDate, // Use actual incident date
  // ... other fields
});
```

#### Option 2: Update Existing Incidents via SQL

If you have incident data with correct dates, you can update them directly:

```sql
-- Example: Update specific incident with correct date
UPDATE alerts
SET created_at = '2026-01-12T22:07:00Z'
WHERE incident_number = 'INC000009764143';
```

### Date Format Parsing

The Excel "Date & Time" column appears to use format: `M/D/YY H:MM AM/PM`

Examples:
- `1/12/26 10:07 PM` = January 12, 2026 at 10:07 PM
- `1/5/26 11:34 AM` = January 5, 2026 at 11:34 AM

JavaScript can parse this format with:
```javascript
new Date('1/12/26 10:07 PM') // Returns Date object
```

### Display Format

In the Incident Detail Modal and Alerts Dashboard, incidents now show:
- **Created**: Formatted date from `created_at` field
- **Last Updated**: Formatted date from `last_updated` field

Both are displayed in localized format:
```
Jan 12, 2026, 10:07 PM
```

### Recommendation

Update the Excel import process to:
1. Parse the "Date & Time" column
2. Convert to ISO timestamp
3. Pass as `created_at` when creating incidents
4. Ensure timezone handling (assume UTC or specify timezone)

This ensures incident timestamps reflect actual occurrence time rather than import time.
