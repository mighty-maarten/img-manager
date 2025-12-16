# Product Overview

img-manager is a web application for managing, scraping, and processing images from web sources.

## Core Features

- **Collections**: Group and organize image sources by URL with labels
- **Web Scraping**: Extract images from web pages with configurable size presets and scraping modes
- **Image Storage**: Store scraped images in S3 with deduplication via content hashing
- **Image Processing**: Process stored images through configurable processing runs
- **Labels**: Categorize collections with custom labels
- **User Authentication**: JWT-based authentication with role-based access

## Domain Concepts

- **Collection**: A URL source containing images, associated with labels
- **Scrape**: A scraping operation result containing extracted image metadata
- **ScrapedImage**: Metadata for an image found during scraping
- **Image**: A stored image file with hash-based deduplication
- **ProcessedImage**: An image that has been processed (e.g., resized, converted)
- **ProcessingRun**: A batch processing operation on a collection
- **Label**: A tag for categorizing collections
