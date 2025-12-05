BEGIN;

ALTER TABLE public.processed_images
    ADD COLUMN hidden BOOLEAN NOT NULL DEFAULT false;

COMMIT;