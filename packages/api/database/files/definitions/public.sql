DROP TABLE IF EXISTS public.images_collections;
DROP TABLE IF EXISTS public.collections_labels;
DROP TABLE IF EXISTS public.scraped_images;
DROP TABLE IF EXISTS public.scrapes;
DROP TABLE IF EXISTS public.processed_images;
DROP TABLE IF EXISTS public.processing_runs;
DROP TABLE IF EXISTS public.labels;
DROP TABLE IF EXISTS public.images;
DROP TABLE IF EXISTS public.collections;
DROP TABLE IF EXISTS public.versions;
DROP TABLE IF EXISTS public.site_settings;
DROP TABLE IF EXISTS public.users;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE public.versions (
    VERSION INT NOT NULL,
    updated_on TIMESTAMPTZ NOT NULL,
    CONSTRAINT "PK_versions_version" PRIMARY KEY (VERSION)
);

INSERT INTO public.versions (VERSION, updated_on) VALUES (0, CURRENT_TIMESTAMP);

CREATE TABLE public.site_settings (
    id TEXT NOT NULL DEFAULT uuid_generate_v4(),
    is_maintenance BOOLEAN NOT NULL,
    created_on TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_updated_on TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PK_site_settings_id" PRIMARY KEY (id)
);

INSERT INTO public.site_settings (is_maintenance) VALUES (false);

CREATE TABLE public.users (
    id TEXT NOT NULL DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_on TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_updated_on TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PK_users_id" PRIMARY KEY (id)
);

CREATE TABLE public.collections (
    id TEXT NOT NULL DEFAULT uuid_generate_v4(),
    url TEXT NOT NULL,
    created_on TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_updated_on TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PK_collections_id" PRIMARY KEY (id)
);

CREATE TABLE public.images (
    id TEXT NOT NULL DEFAULT uuid_generate_v4(),
    hash TEXT NOT NULL,
    filename TEXT NOT NULL,
    url TEXT NOT NULL,
    bucket TEXT NOT NULL,
    key TEXT NOT NULL,
    created_on TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_updated_on TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PK_images_id" PRIMARY KEY (id)
);

CREATE TABLE public.labels (
    id TEXT NOT NULL DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_on TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_updated_on TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PK_labels_id" PRIMARY KEY (id)
);

CREATE TABLE public.scrapes (
    id TEXT NOT NULL DEFAULT uuid_generate_v4(),
    size_preset TEXT NOT NULL,
    scraping_mode TEXT NOT NULL,
    errors TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    categories TEXT[] DEFAULT '{}',
    models TEXT[] DEFAULT '{}',
    collection_id TEXT NOT NULL,
    created_on TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_updated_on TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PK_scrapes_id" PRIMARY KEY (id),
    CONSTRAINT "UQ_scrapes_collection_id" UNIQUE (collection_id),
    CONSTRAINT "FK_scrapes_collection_id" FOREIGN KEY (collection_id)
        REFERENCES public.collections(id) ON DELETE CASCADE
);

CREATE TABLE public.scraped_images (
    id TEXT NOT NULL DEFAULT uuid_generate_v4(),
    filename TEXT NOT NULL,
    url TEXT NOT NULL,
    source_url TEXT NOT NULL,
    width INT,
    height INT,
    file_size INT,
    format TEXT,
    thumbnail_data_url TEXT,
    downloaded_on TIMESTAMPTZ,
    scrape_id TEXT NOT NULL,
    image_id TEXT,
    created_on TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_updated_on TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PK_scraped_images_id" PRIMARY KEY (id),
    CONSTRAINT "FK_scraped_images_scrape_id" FOREIGN KEY (scrape_id)
        REFERENCES public.scrapes(id) ON DELETE CASCADE,
    CONSTRAINT "FK_scraped_images_image_id" FOREIGN KEY (image_id)
        REFERENCES public.images(id) ON DELETE SET NULL
);

CREATE TABLE public.processing_runs (
    id TEXT NOT NULL DEFAULT uuid_generate_v4(),
    collection_id TEXT NOT NULL,
    label_id TEXT NOT NULL,
    created_on TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_updated_on TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PK_processing_runs_id" PRIMARY KEY (id),
    CONSTRAINT "FK_processing_runs_collection_id" FOREIGN KEY (collection_id)
        REFERENCES public.collections(id) ON DELETE CASCADE,
    CONSTRAINT "FK_processing_runs_label_id" FOREIGN KEY (label_id)
        REFERENCES public.labels(id) ON DELETE CASCADE
);

CREATE TABLE public.processed_images (
    id TEXT NOT NULL DEFAULT uuid_generate_v4(),
    filename TEXT NOT NULL,
    bucket TEXT NOT NULL,
    key TEXT NOT NULL,
    hidden BOOLEAN NOT NULL DEFAULT false,
    score INT,
    processing_run_id TEXT NOT NULL,
    source_image_id TEXT NOT NULL,
    created_on TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_updated_on TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PK_processed_images_id" PRIMARY KEY (id),
    CONSTRAINT "FK_processed_images_processing_run_id" FOREIGN KEY (processing_run_id)
        REFERENCES public.processing_runs(id) ON DELETE CASCADE,
    CONSTRAINT "FK_processed_images_source_image_id" FOREIGN KEY (source_image_id)
        REFERENCES public.images(id) ON DELETE CASCADE
);

CREATE TABLE public.collections_labels (
    collection_id TEXT NOT NULL,
    label_id TEXT NOT NULL,
    CONSTRAINT "PK_collections_labels" PRIMARY KEY (collection_id, label_id),
    CONSTRAINT "FK_collections_labels_collection_id" FOREIGN KEY (collection_id)
        REFERENCES public.collections(id) ON DELETE CASCADE,
    CONSTRAINT "FK_collections_labels_label_id" FOREIGN KEY (label_id)
        REFERENCES public.labels(id) ON DELETE CASCADE
);

CREATE TABLE public.images_collections (
    image_id TEXT NOT NULL,
    collection_id TEXT NOT NULL,
    CONSTRAINT "PK_images_collections" PRIMARY KEY (image_id, collection_id),
    CONSTRAINT "FK_images_collections_image_id" FOREIGN KEY (image_id)
        REFERENCES public.images(id) ON DELETE CASCADE,
    CONSTRAINT "FK_images_collections_collection_id" FOREIGN KEY (collection_id)
        REFERENCES public.collections(id) ON DELETE CASCADE
);
