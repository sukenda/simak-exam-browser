# Cheating Report API Endpoint

## Endpoint Information

**URL:** `{ATTENTION_WEBHOOK_URL}/kurikulum/exam-reports`

**Method:** `POST`

**Content-Type:** `application/json`

## Headers

```
Content-Type: application/json
User-Agent: simak-exam-browser/{version}
X-Secret-Key: {EXAM_REPORT_SECRET_KEY}
```

## Request Body Structure

**Struktur payload menggunakan camelCase untuk konsistensi dengan JavaScript/TypeScript conventions.**

Lihat file:
- `sample-cheating-report-payload.json` - Contoh payload lengkap dengan banyak events
- `sample-cheating-report-minimal.json` - Contoh payload minimal untuk testing

### Database Mapping

Payload menggunakan camelCase, backend perlu convert ke snake_case untuk database:

| Payload Field (camelCase) | Database Column (snake_case) | Type |
|---------------------------|------------------------------|------|
| `reportId` | `report_id` | VARCHAR(100) |
| `studentId` | `student_id` | VARCHAR(50) |
| `studentName` | `student_name` | VARCHAR(255) |
| `studentEmail` | - | (additional field) |
| `studentNisn` | - | (additional field) |
| `studentKelas` | - | (additional field) |
| `studentJurusan` | - | (additional field) |
| `examId` | `exam_id` | VARCHAR(50) |
| `examName` | `exam_name` | VARCHAR(255) |
| `sessionId` | `session_id` | VARCHAR(100) |
| `sessionStartTime` | `session_start_time` | DATETIME (convert from ISO 8601) |
| `sessionEndTime` | `session_end_time` | DATETIME (convert from ISO 8601) |
| `durationSeconds` | `duration_seconds` | INT |
| `totalEvents` | `total_events` | INT |
| `eventsByType` | `events_by_type` | JSON (keys converted to snake_case) |
| `eventsBySeverity` | `events_by_severity` | JSON |
| `riskScore` | `risk_score` | DECIMAL(3,2) |
| `suspiciousActivities` | `suspicious_activities` | JSON |
| `platform` | `platform` | VARCHAR(50) |
| `appVersion` | `app_version` | VARCHAR(50) |
| `electronVersion` | `electron_version` | VARCHAR(50) |
| `eventsData` | `events_data` | JSON |
| `ipAddress` | `ip_address` | VARCHAR(50) |
| `machineId` | `machine_id` | VARCHAR(255) |
| `timezone` | `timezone` | VARCHAR(100) |

**Note:** `eventsByType` keys juga menggunakan camelCase (e.g., `shortcutBlocked`, `windowBlur`), backend perlu convert ke snake_case jika diperlukan.

## Field Descriptions

### Top Level Fields

- `reportId` (string): Unique identifier untuk report (format: timestamp-random)
- `reportType` (string): Always "cheating_report"
- `reportVersion` (string): Version format, currently "1.0"

### Student Object

- `id` (string, optional): Student ID
- `name` (string, optional): Student name
- `email` (string, optional): Student email
- `nisn` (string, optional): NISN
- `kelas` (string, optional): Class
- `jurusan` (string, optional): Major/Department
- `examId` (string, optional): Exam ID
- `examName` (string, optional): Exam name
- `sessionId` (string, optional): Session ID
- Can be `null` if student not logged in

### Session Object

- `startTime` (string, ISO 8601): Session start time (from first event)
- `endTime` (string, ISO 8601): Session end time (when report sent)
- `duration` (number): Duration in seconds
- `examId` (string, optional): Exam ID
- `examName` (string, optional): Exam name
- `sessionId` (string, optional): Session ID

### Summary Object

- `totalEvents` (number): Total number of events
- `eventsByType` (object): Count of events by type
- `eventsBySeverity` (object): Count of events by severity (low, medium, high, critical)
- `riskScore` (number): Calculated risk score (0.00 - 10.00)
- `suspiciousActivities` (array): List of suspicious activity descriptions

### Events Array

Each event contains:
- `id` (string): Unique event ID
- `eventType` (string): Type of event (shortcut_blocked, window_blur, etc.)
- `eventName` (string): Human readable event name
- `severity` (string): Event severity (low, medium, high, critical)
- `timestamp` (string, ISO 8601): When event occurred
- `platform` (string): Platform (linux, win32, darwin)
- `appVersion` (string): Application version
- `metadata` (object): Event-specific metadata

### Technical Object

- `platform` (string): Operating system platform
- `arch` (string): Architecture (x64, ia32, arm64)
- `appVersion` (string): Application version
- `electronVersion` (string): Electron version
- `nodeVersion` (string): Node.js version
- `osVersion` (string): OS version string

### Metadata Object

- `reportGeneratedAt` (string, ISO 8601): When report was generated
- `reportSentAt` (string, ISO 8601): When report was sent
- `timezone` (string): Timezone (e.g., "Asia/Jakarta")
- `ipAddress` (string, optional): Local IP address
- `machineId` (string): Machine identifier

## Event Types

- `shortcut_blocked`: Keyboard shortcut was blocked
- `window_blur`: Window lost focus
- `window_minimize`: Window was minimized
- `window_restore`: Window was restored
- `download`: File was downloaded
- `copy_attempt`: Copy attempt detected
- `paste_attempt`: Paste attempt detected
- `context_menu`: Context menu attempt
- `devtools_attempt`: DevTools open attempt
- `fullscreen_exit`: Window exited fullscreen
- `taskbar_visible`: Taskbar became visible
- `multiple_window`: Multiple window detected
- `screen_capture`: Screen capture attempt

## Severity Levels

- `low`: Low risk activity
- `medium`: Medium risk activity
- `high`: High risk activity
- `critical`: Critical risk activity (e.g., window minimize, fullscreen exit)

## Expected Response

### Success Response (200 OK)

```json
{
  "success": true,
  "reportId": "received-report-id",
  "message": "Report received successfully",
  "timestamp": "2024-01-15T12:00:05.000Z"
}
```

### Error Response (4xx/5xx)

```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "2024-01-15T12:00:05.000Z"
}
```

## Testing

1. Use the sample payload files for testing
2. Make sure to set `X-Secret-Key` header correctly
3. Verify that the endpoint accepts POST requests
4. Check that the response format matches expected structure

## Notes

- All timestamps are in ISO 8601 format (UTC)
- Student object can be `null` if student is not logged in
- Events array can be empty if no events were tracked
- Risk score is calculated based on event severity and patterns
- Suspicious activities are automatically detected based on event patterns

