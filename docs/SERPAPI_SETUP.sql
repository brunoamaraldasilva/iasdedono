-- SerpAPI Web Search Setup
-- Tables for caching and logging web search usage

-- 1. Cache de resultados de web search
CREATE TABLE IF NOT EXISTS web_search_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash TEXT UNIQUE NOT NULL,
  query TEXT NOT NULL,
  results JSONB NOT NULL,
  formatted_for_prompt TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  hits INT DEFAULT 0,

  INDEX idx_expires_at (expires_at),
  INDEX idx_query_hash (query_hash)
);

-- 2. Log de uso de web search (auditoria + analytics)
CREATE TABLE IF NOT EXISTS web_search_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  results_count INT DEFAULT 0,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  cache_hit BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_user_date (user_id, created_at),
  INDEX idx_conversation (conversation_id)
);

-- 3. Agregação diária de uso (para dashboard)
CREATE TABLE IF NOT EXISTS web_search_daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stat_date DATE UNIQUE NOT NULL,
  total_searches INT DEFAULT 0,
  unique_users INT DEFAULT 0,
  cache_hit_rate DECIMAL(5, 2) DEFAULT 0,
  avg_results_per_search DECIMAL(5, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_date (stat_date)
);

-- 4. RLS Policies para web_search_cache (readable by everyone, writable by system)
ALTER TABLE web_search_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read search cache" ON web_search_cache
  FOR SELECT USING (true);

CREATE POLICY "System can write search cache" ON web_search_cache
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update search cache" ON web_search_cache
  FOR UPDATE USING (true);

-- 5. RLS Policies para web_search_usage (users see only their own)
ALTER TABLE web_search_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see only their searches" ON web_search_usage
  FOR SELECT USING (
    auth.uid() = user_id OR
    auth.jwt() ->> 'role' = 'admin'
  );

CREATE POLICY "Users can insert their own searches" ON web_search_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. RLS Policies para web_search_daily_stats (admins only)
ALTER TABLE web_search_daily_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read stats" ON web_search_daily_stats
  FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "System can write stats" ON web_search_daily_stats
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update stats" ON web_search_daily_stats
  FOR UPDATE USING (true);

-- 7. Create function to update cache hits
CREATE OR REPLACE FUNCTION increment_search_cache_hit(query_hash TEXT)
RETURNS void AS $$
BEGIN
  UPDATE web_search_cache
  SET hits = hits + 1
  WHERE web_search_cache.query_hash = query_hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create function to update daily stats
CREATE OR REPLACE FUNCTION update_daily_search_stats()
RETURNS void AS $$
BEGIN
  INSERT INTO web_search_daily_stats (stat_date, total_searches, unique_users, cache_hit_rate, avg_results_per_search)
  SELECT
    CURRENT_DATE,
    COUNT(*) as total_searches,
    COUNT(DISTINCT user_id) as unique_users,
    ROUND(
      SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END)::decimal / COUNT(*)::decimal * 100,
      2
    ) as cache_hit_rate,
    ROUND(AVG(results_count)::decimal, 2) as avg_results_per_search
  FROM web_search_usage
  WHERE DATE(created_at) = CURRENT_DATE
  ON CONFLICT (stat_date)
  DO UPDATE SET
    total_searches = EXCLUDED.total_searches,
    unique_users = EXCLUDED.unique_users,
    cache_hit_rate = EXCLUDED.cache_hit_rate,
    avg_results_per_search = EXCLUDED.avg_results_per_search;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Cleanup old cache entries (keep 7 days of cache)
CREATE OR REPLACE FUNCTION cleanup_old_search_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM web_search_cache
  WHERE expires_at < NOW() AND hits < 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Execute cleanup daily at midnight (requires pg_cron extension)
-- This requires Supabase Realtime or scheduled job
-- For now, cleanup should be done manually or via a cron service

COMMIT;
