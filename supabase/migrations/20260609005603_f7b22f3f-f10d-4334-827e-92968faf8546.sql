CREATE OR REPLACE FUNCTION public.list_question_categories()
RETURNS TABLE(name text, count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT category::text AS name, COUNT(*)::bigint AS count
  FROM public.questions
  WHERE category IS NOT NULL AND category <> ''
  GROUP BY category
  ORDER BY category;
$$;
GRANT EXECUTE ON FUNCTION public.list_question_categories() TO authenticated, service_role;