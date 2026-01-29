# Product Overview

img-manager is an image management application for scraping, storing, and processing images from web sources.

## Core Features

- **Collections**: Group URLs for batch image scraping with label organization
- **Scraping**: Extract images from web pages with configurable size presets and modes
- **Storage**: Store scraped images in S3 with deduplication via content hashing
- **Processing**: Run image processing pipelines on stored images
- **Labels**: Organize collections with customizable labels

## User Workflow

1. Create collections by providing URLs and assigning labels
2. Scrape collections to extract image metadata
3. Store scraped images to S3 (deduplicated by hash)
4. Process stored images through configured pipelines
5. Download or view processed results

## Architecture

- Monorepo with separate client (Vue) and API (NestJS) packages
- PostgreSQL database for metadata
- S3 for image storage (local filesystem in development)
- JWT-based authentication
