# Privacy Policy

**Last Updated:** January 2025

Animepahe DL Desktop respects your privacy. This document explains what data we collect, how we use it, and your rights regarding your data.

## Overview

Animepahe DL Desktop includes **optional analytics** to help us improve the app. Analytics are **enabled by default** but can be disabled at any time through the app settings or environment variables.

## Data Collection Philosophy

We believe in **privacy-first analytics**:
- ✅ Collect only what's necessary to improve the app
- ✅ Anonymize and categorize data whenever possible
- ✅ Never collect personal information or sensitive content
- ✅ Give you full control over data collection
- ✅ Be transparent about what we track

## What We Collect

### Super Properties (Sent with Every Event)

These properties are automatically included with every analytics event:

| Property | Description | Example |
|----------|-------------|---------|
| `app_version` | Current version of the app | `0.3.1` |
| `os_type` | Operating system type only | `Windows`, `macOS`, or `Linux` |
| `app_environment` | Development or production | `production` |
| `ui_theme` | Current UI theme | `dark` or `light` |
| `session_id` | Random anonymous session ID | `session_1234567890_abc123` |

**Note:** We do NOT collect OS versions, hardware specifications, or any personally identifiable information.

### Tracked Events

We collect anonymous usage data organized into the following categories:

#### 1. User Actions

Events related to your interactions with the app:

| Event Name | Description | Data Collected |
|------------|-------------|----------------|
| `anime_searched` | When you search for anime | Query length only (not the actual query) |
| `search_results_received` | When search results are received | Number of results |
| `anime_selected` | When you select an anime | Nothing sensitive |
| `episode_selected` | When you select episodes | Episode count only |
| `download_initiated` | When you start a download | Episode count, resolution preference, audio preference, download mode |
| `download_completed` | When a download finishes | Success/failure status, episode count |

**What We DON'T Collect:**
- ❌ Anime titles or search queries
- ❌ Episode numbers or specific content

#### 2. App Usage

Events related to general app usage:

| Event Name | Description | Data Collected |
|------------|-------------|----------------|
| `app_launched` | When the app starts | Timestamp |
| `session_started` | When the app gains focus | Timestamp |
| `session_duration` | When the app loses focus | Duration in minutes (rounded) |
| `settings_changed` | When you modify settings | Setting type only (e.g., "theme", "baseUrl") |
| `theme_toggled` | When you switch themes | New theme value |

**What We DON'T Collect:**
- ❌ Setting values (except theme)
- ❌ File paths or directory names
- ❌ Base URLs you configure

#### 3. Feature Usage

Events related to specific features:

| Event Name | Description | Data Collected |
|------------|-------------|----------------|
| `tour_started` | When you start the app tour | Timestamp |
| `tour_step_viewed` | When you view a tour step | Step index and ID |
| `tour_completed` | When you complete the tour | Timestamp |
| `tour_skipped` | When you skip the tour | Step index where skipped |
| `requirements_checked` | When dependency check runs | ffmpeg/node availability (true/false) |
| `preview_modal_opened` | When you open source preview | Nothing sensitive |

#### 4. Performance Monitoring

Events related to app performance (values are categorized, not exact):

| Event Name | Description | Data Collected |
|------------|-------------|----------------|
| `search_performance` | Search response time | Categorized as "fast" (<500ms), "medium" (500-2000ms), or "slow" (>2000ms) |
| `download_performance` | Download speed | Speed category ("very-slow" to "very-fast") and file size category ("small" to "very-large") |
| `app_startup_time` | Time from launch to ready | Categorized as "fast" (<1s), "medium" (1-3s), or "slow" (>3s) |

**Note:** We categorize performance metrics instead of collecting exact values to protect your privacy while still understanding app performance.

#### 5. Error Tracking

Events related to errors (no sensitive information):

| Event Name | Description | Data Collected |
|------------|-------------|----------------|
| `download_error` | When a download fails | Error type only (no error messages or details) |
| `app_error` | When an error occurs | Error type and component name only (no stack traces or messages) |

**What We DON'T Collect:**
- ❌ Exact error messages
- ❌ Stack traces
- ❌ File paths from errors
- ❌ Any content that could identify what you were downloading

## What We DON'T Collect

We **never** collect:

- ❌ **Anime titles or search queries** - We only track query length
- ❌ **File names or file paths** - We never see what you download or where
- ❌ **Personal information** - No names, emails, or contact info
- ❌ **IP addresses** - PostHog anonymizes IPs by default
- ❌ **Exact error messages or stack traces** - Only error types
- ❌ **System specifications** - Only OS type (Windows/macOS/Linux)
- ❌ **Precise timestamps** - Only categorized durations
- ❌ **Setting values** - Only the fact that a setting was changed

## How We Use This Data

We use analytics data exclusively to:

1. **Understand feature usage** - Which features are most/least used
2. **Identify bugs and errors** - What types of errors users encounter
3. **Improve performance** - Where the app is slow or could be faster
4. **Guide development** - What features to prioritize or improve
5. **Ensure compatibility** - Which operating systems need support

We **never**:
- Sell your data to third parties
- Use data for advertising or marketing
- Share data with anyone except our analytics provider (PostHog)
- Use data to identify individual users

## Data Storage and Retention

### Analytics Provider

We use **PostHog** as our analytics provider. PostHog processes all analytics data with privacy-first defaults:

- **IP Anonymization:** PostHog automatically anonymizes IP addresses
- **Data Location:** PostHog stores data in secure, GDPR-compliant data centers
- **Encryption:** All data is encrypted in transit and at rest

### Retention Policy

- **Event data** is retained for **90 days** by default
- **Session IDs** are stored locally on your device and never expire (you can reset them anytime)
- **No user profiles** are created or maintained

For PostHog's complete data retention and security policies, visit:
- [PostHog Privacy Policy](https://posthog.com/privacy)
- [PostHog Security](https://posthog.com/security)

## Your Rights and Controls

### Disabling Analytics

You have complete control over analytics collection. You can disable it at any time:

#### Method 1: In-App Toggle
1. Open the app settings (gear icon)
2. Toggle off "Share anonymous usage data"
3. Changes take effect immediately

#### Method 2: Environment Variables
Create a `.env` file in the project root:
```env
VITE_ENABLE_ANALYTICS=false
```

#### Method 3: Development Mode
Analytics are automatically disabled in development mode unless explicitly enabled.

### Viewing What's Tracked

To see exactly what data is being collected:
1. Open app settings
2. Click "View Details" in the analytics section
3. The Analytics Dashboard shows all tracked events and properties

### Clearing Your Data

You can clear all locally stored analytics data:
1. Open app settings
2. Click "View Details" to open Analytics Dashboard
3. Click "Clear Analytics Data"

This will:
- Clear all PostHog data stored locally
- Remove your session ID
- Generate a new session ID on next launch

### Resetting Your Session ID

To generate a new anonymous session ID:
1. Open Analytics Dashboard
2. Click "Reset Anonymous ID"
3. A new random session ID will be generated
4. Previous analytics data remains but won't be linked to the new ID

## Data Deletion Requests

If you want your analytics data deleted from PostHog's servers:

1. **Collect your Session ID:**
   - Open Analytics Dashboard
   - Your session ID is displayed in the "Super Properties" section

2. **Submit a deletion request:**
   - Email: [Your contact email here]
   - Subject: "Analytics Data Deletion Request"
   - Include your session ID

We will process deletion requests within **30 days** and confirm when complete.

**Note:** Since we don't collect any personally identifiable information, we cannot verify your identity. Deletion requests will be processed based on the session ID you provide.

## Children's Privacy

Animepahe DL Desktop does not knowingly collect data from children under 13. If you believe we have inadvertently collected such data, please contact us immediately.

## Changes to This Policy

We may update this privacy policy from time to time. When we do:
- The "Last Updated" date at the top will be changed
- Significant changes will be announced in app release notes
- Continued use of the app after changes constitutes acceptance

## Open Source Transparency

Animepahe DL Desktop is open source. You can review our analytics implementation:
- [PostHog configuration](src/lib/posthog.tsx)
- [Analytics utilities](src/lib/analytics-utils.ts)
- [Analytics dashboard](src/components/AnalyticsDashboard.tsx)

## Contact

For privacy questions, concerns, or data deletion requests:

- **GitHub Issues:** [https://github.com/StrangeNoob/animepahe-dl-desktop/issues](https://github.com/StrangeNoob/animepahe-dl-desktop/issues)
- **Email:** [Your contact email]
- **Project Repository:** [https://github.com/StrangeNoob/animepahe-dl-desktop](https://github.com/StrangeNoob/animepahe-dl-desktop)

## Third-Party Services

This app uses the following third-party services that may collect data:

| Service | Purpose | Privacy Policy |
|---------|---------|----------------|
| PostHog | Analytics | [posthog.com/privacy](https://posthog.com/privacy) |

We do not control these third-party services and recommend reviewing their privacy policies.

## Legal Compliance

This privacy policy is designed to comply with:
- General Data Protection Regulation (GDPR)
- California Consumer Privacy Act (CCPA)
- Other applicable privacy regulations

Your use of this app is also governed by the [MIT License](LICENSE).

---

**Summary:** We collect minimal, anonymous usage data to improve the app. We never collect personal information, anime titles, or file paths. You can disable analytics anytime and request data deletion. We use PostHog with privacy-first defaults and retain data for 90 days.
