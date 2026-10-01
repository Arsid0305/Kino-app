-- Удаление legacy-таблиц времён входа по device_id и бэкапов дедупликации.
-- Решение владелицы 2026-10-01. Перед удалением: 877 из 881 строки films_history
-- уже есть в kino.user_movies; остаток (4 строки) и три бэкапа (122 строки)
-- выгружены в JSON у владелицы. Доступ к таблицам закрыт в 20261001190000.
DROP TABLE IF EXISTS kino.films_history;
DROP TABLE IF EXISTS kino.user_settings;
DROP TABLE IF EXISTS kino.users;
DROP TABLE IF EXISTS kino.watchlist_dupes_backup_20260816;
DROP TABLE IF EXISTS kino.dupes_backup_20260816_v2;
DROP TABLE IF EXISTS kino.dedupe_backup_20260829;
