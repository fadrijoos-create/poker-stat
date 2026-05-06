import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "DEINE_SUPABASE_URL",
  "DEIN_ANON_KEY"
);