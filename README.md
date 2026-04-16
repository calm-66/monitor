# Monitor

A Next.js-based analytics dashboard for tracking website traffic and user behavior.

## Features

- **Multi-project Support**: Create and manage multiple projects with isolated data
- **Real-time Analytics**: Track page views, unique visitors, and active users
- **Geographic Distribution**: View user locations by country, region, and city
- **Device Analytics**: Analyze device types, browsers, and operating systems
- **Session-based Authentication**: Secure dashboard access with session tokens

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL (Neon)
- **Deployment**: Vercel

## Prerequisites

- Node.js 18+
- PostgreSQL database (Neon recommended)
- Vercel account (for deployment)

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Required environment variables:
- `DATABASE_URL`: Your PostgreSQL connection string
- `DASHBOARD_PASSWORD`: Password for dashboard admin access

### 3. Set Up Database

Run the SQL migration scripts in your database:

```sql
-- Create SessionToken table for dashboard authentication
-- Run this in your database (Neon Console or psql)
CREATE TABLE "SessionToken" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT UNIQUE NOT NULL,
    expiresAt TIMESTAMPTZ NOT NULL,
    createdAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "SessionToken_token_idx" ON "SessionToken"(token);
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Project Structure

```
Monitor/
├── src/
│   ├── app/
│   │   ├── api/           # API routes
│   │   │   ├── auth/      # Authentication APIs (login, logout, session)
│   │   │   ├── projects/  # Project management APIs
│   │   │   └── stats/     # Analytics data APIs
│   │   ├── dashboard/     # Dashboard pages
│   │   ├── login/         # Login page
│   │   └── page.tsx       # Home page
│   ├── lib/               # Utility functions
│   └── types/             # TypeScript type definitions
├── prisma/
│   └── schema.prisma      # Database schema
├── scripts/               # SQL migration scripts
└── doc/                   # Documentation
```

## Authentication

The dashboard uses a session-based authentication system:

1. **Login**: Navigate to `/login` and enter the admin password
2. **Session Token**: Upon successful login, a session token is stored in localStorage
3. **Auto-login**: The session is automatically validated on page load
4. **Sliding Expiry**: Sessions expire after 30 days of inactivity
5. **Logout**: Click "Logout" in the dashboard to end your session

### Security Features

- Password stored in environment variable (`DASHBOARD_PASSWORD`)
- Cryptographically secure session tokens (32 bytes random)
- HTTPS required for production
- Server-side validation for all API requests

## API Integration

### External Projects (e.g., UsOnly)

External projects can send analytics data to Monitor using the API Key:

1. Create a project in the Monitor dashboard
2. Copy the generated API Key
3. Configure your external project to send events to Monitor's API

The Monitor system is independent of the UsOnly user authentication system. UsOnly users' login events are tracked, but they cannot access the Monitor dashboard.

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import your repository to Vercel
3. Add environment variables in Vercel settings:
   - `DATABASE_URL`
   - `DASHBOARD_PASSWORD`
4. Deploy

### Database Migration

Before deploying, run the SQL migration script in your production database:

```bash
# Run the migration script in Neon Console
scripts/create-session-token-table.sql
```

## Documentation

- [External API Integration](doc/external-api-integration.md)
- [Login Tracking Integration](doc/login-tracking-integration.md)
- [Implementation Plan](implementation_plan.md)

## License

MIT