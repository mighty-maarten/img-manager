BEGIN;

ALTER TABLE public.processed_images
    ADD COLUMN score INT;

COMMIT;
