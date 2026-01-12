-- Add new columns to suppliers table for expanded contact information
ALTER TABLE public.suppliers
ADD COLUMN phone text,
ADD COLUMN website text,
ADD COLUMN location text,
ADD COLUMN factory text,
ADD COLUMN focus_area text,
ADD COLUMN logo_url text,
ADD COLUMN contact_person text,
ADD COLUMN notes text;