-- Схема kino открыта в Data API, а legacy-таблицы времён входа по device_id
-- (users, films_history, user_settings) имели политики USING (true) для public
-- и гранты anon: любой с публичным ключом мог читать и писать их.
-- Кодом приложения не используются (последняя активность 2026-02-16).
-- Удаление — отдельным решением владелицы; здесь только закрываем доступ.
REVOKE ALL ON TABLE kino.users, kino.films_history, kino.user_settings FROM anon, authenticated, PUBLIC;

-- В user_settings лежал старый DeepSeek-ключ (в кабинете DeepSeek уже не существует).
UPDATE kino.user_settings SET deepseek_api_key = NULL WHERE deepseek_api_key IS NOT NULL;

-- Advisor 0028/0029: SECURITY DEFINER функция вызывалась anon/authenticated через /rpc.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
