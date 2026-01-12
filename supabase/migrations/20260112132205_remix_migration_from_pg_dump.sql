CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    price text,
    image_url text,
    product_url text NOT NULL,
    sku text,
    competitor text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    supplier_id uuid,
    notes text,
    is_sent boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT products_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'positive'::text, 'negative'::text, 'requested'::text])))
);


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_product_url_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_product_url_key UNIQUE (product_url);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: idx_products_product_url; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_product_url ON public.products USING btree (product_url);


--
-- Name: idx_products_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_status ON public.products USING btree (status);


--
-- Name: idx_products_supplier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_supplier_id ON public.products USING btree (supplier_id);


--
-- Name: products update_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: suppliers update_suppliers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: products products_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: products Allow public delete on products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public delete on products" ON public.products FOR DELETE USING (true);


--
-- Name: suppliers Allow public delete on suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public delete on suppliers" ON public.suppliers FOR DELETE USING (true);


--
-- Name: products Allow public insert on products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert on products" ON public.products FOR INSERT WITH CHECK (true);


--
-- Name: suppliers Allow public insert on suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert on suppliers" ON public.suppliers FOR INSERT WITH CHECK (true);


--
-- Name: products Allow public read on products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read on products" ON public.products FOR SELECT USING (true);


--
-- Name: suppliers Allow public read on suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read on suppliers" ON public.suppliers FOR SELECT USING (true);


--
-- Name: products Allow public update on products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public update on products" ON public.products FOR UPDATE USING (true);


--
-- Name: suppliers Allow public update on suppliers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public update on suppliers" ON public.suppliers FOR UPDATE USING (true);


--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;