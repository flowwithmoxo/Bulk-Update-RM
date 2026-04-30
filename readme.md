# Moxo Bulk Relationship Manager

Create advisor-client relationships in bulk using Moxo API v1.

## Features

- 🔐 OAuth token generation
- 👥 Bulk client & advisor management
- 📊 CSV upload support
- 🚀 Bulk relationship creation
- ⏱️ Rate limiting with delay controls
- 💾 Local config saving

## How to Use

1. **Configure API Settings**
   - Enter your Moxo domain, Org ID, Client ID & Secret
   - Select identity type (email/unique_id/phone)
   - Generate access token

2. **Add Clients & Advisors**
   - Paste emails manually or upload CSV
   - Each client gets mapped to ALL advisors

3. **Launch Bulk Creation**
   - Set delay between requests (ms)
   - Click Start and monitor progress

## CSV Format

**clients_sample.csv**
```csv
email
client1@example.com
client2@example.com
