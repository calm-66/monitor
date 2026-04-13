-- Monitor Platform Database Migration Script
-- Generated for Neon PostgreSQL
-- Run this script on your Neon database to create the required tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create Project table
CREATE TABLE "Project" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "apiKey" TEXT NOT NULL,
    "domain" TEXT,
    "statsApiUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- Create Event table
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventName" TEXT,
    "sessionId" TEXT,
    "pageUrl" TEXT,
    "pageTitle" TEXT,
    "referrer" TEXT,
    "userId" TEXT,
    "ipAddress" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "userAgent" TEXT,
    "deviceType" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "screenWidth" INTEGER,
    "screenHeight" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- Create IpLimitTracker table
CREATE TABLE "IpLimitTracker" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "projectId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "successfulResolves" INTEGER NOT NULL DEFAULT 0,
    "rateLimitedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "IpLimitTracker_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE UNIQUE INDEX "Project_name_key" ON "Project"("name");
CREATE UNIQUE INDEX "Project_apiKey_key" ON "Project"("apiKey");

CREATE INDEX "Event_projectId_createdAt_idx" ON "Event"("projectId", "createdAt");
CREATE INDEX "Event_projectId_eventType_idx" ON "Event"("projectId", "eventType");
CREATE INDEX "Event_country_idx" ON "Event"("country");

CREATE UNIQUE INDEX "IpLimitTracker_projectId_date_key" ON "IpLimitTracker"("projectId", "date");

-- Add foreign key constraints
ALTER TABLE "Event" ADD CONSTRAINT "Event_projectId_fkey" 
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE;

ALTER TABLE "IpLimitTracker" ADD CONSTRAINT "IpLimitTracker_projectId_fkey" 
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE;

-- Insert a default project (optional - you can also create projects via API)
-- Uncomment the following lines if you want to create a default project
/*
INSERT INTO "Project" ("name", "description", "apiKey", "domain", "isActive")
VALUES ('default-project', 'Default project for monitoring', 'mk_' || encode(gen_random_bytes(16), 'hex'), NULL, true);
*/