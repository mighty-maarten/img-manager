BEGIN;

ALTER TABLE public.processed_images
    ADD COLUMN flagged BOOLEAN NOT NULL DEFAULT false;

COMMIT;
