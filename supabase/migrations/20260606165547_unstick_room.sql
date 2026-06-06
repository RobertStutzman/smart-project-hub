update public.rooms set phase='ended', status='ended' where phase='reveal' and question_started_at < now() - interval '1 minute';
