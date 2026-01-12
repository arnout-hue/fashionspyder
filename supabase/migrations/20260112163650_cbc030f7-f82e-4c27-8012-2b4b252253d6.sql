-- Create a table for internal colleagues
CREATE TABLE public.colleagues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  department TEXT,
  role TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.colleagues ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated user access
CREATE POLICY "Authenticated users can read colleagues" 
ON public.colleagues 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert colleagues" 
ON public.colleagues 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update colleagues" 
ON public.colleagues 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete colleagues" 
ON public.colleagues 
FOR DELETE 
TO authenticated
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_colleagues_updated_at
BEFORE UPDATE ON public.colleagues
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();