import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DuplicateGroup {
  normalized_name: string;
  competitor_count: number;
  product_count: number;
  competitors: string[];
  product_ids: string[];
  product_names: string[];
  prices: (number | null)[];
  image_urls: (string | null)[];
  product_urls: string[];
}

export function useDuplicateProducts(minCompetitors = 2) {
  return useQuery({
    queryKey: ["duplicateProducts", minCompetitors],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_duplicate_products", {
        min_competitors: minCompetitors,
        max_results: 100,
      } as any);

      if (error) throw error;
      return (data as any[])?.map((d) => ({
        normalized_name: d.normalized_name,
        competitor_count: Number(d.competitor_count),
        product_count: Number(d.product_count),
        competitors: d.competitors as string[],
        product_ids: d.product_ids as string[],
        product_names: d.product_names as string[],
        prices: d.prices as (number | null)[],
        image_urls: d.image_urls as (string | null)[],
        product_urls: d.product_urls as string[],
      })) as DuplicateGroup[] || [];
    },
    staleTime: 60000,
  });
}
