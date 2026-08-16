-- Fix Supabase advisor ERROR: security_definer_view для public.chat_messages и public.user_movies.
-- Views создавались вне git через SQL Editor и по умолчанию исполнялись под правами создателя,
-- игнорируя RLS — любой залогиненный видел чужие записи. Переключаем в security_invoker,
-- чтобы SELECT шёл под auth.uid() вызывающего и RLS базовых таблиц применялся.
ALTER VIEW public.chat_messages SET (security_invoker = on);
ALTER VIEW public.user_movies SET (security_invoker = on);
