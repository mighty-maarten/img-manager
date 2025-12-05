BEGIN;

-- Rename downloaded column to stored in scrapes table
ALTER TABLE public.scrapes RENAME COLUMN downloaded TO stored;

-- Rename downloaded_on column to stored_on in scraped_images table
ALTER TABLE public.scraped_images RENAME COLUMN downloaded_on TO stored_on;

COMMIT;
