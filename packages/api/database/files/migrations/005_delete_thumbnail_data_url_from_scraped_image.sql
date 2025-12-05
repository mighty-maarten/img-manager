BEGIN;

ALTER TABLE public.scraped_images
DROP COLUMN thumbnail_data_url;

COMMIT;