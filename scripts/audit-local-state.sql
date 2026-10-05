SELECT status, COUNT(*) AS count FROM jobs GROUP BY status ORDER BY status;
SELECT id, kind, prospect_id, status, attempts, max_attempts, run_after, last_error, claimed_by, claimed_at, created_at, updated_at FROM jobs WHERE status IN ('PENDING', 'RUNNING', 'SENDING', 'SEND_UNKNOWN', 'DEAD_LETTER') ORDER BY updated_at;
SELECT state, COUNT(*) AS count FROM prospects GROUP BY state ORDER BY state;
SELECT id, company_name, activity, location, opportunity, state, score, updated_at FROM prospects ORDER BY updated_at DESC;
SELECT runner_id, status, current_job_id, last_seen_at FROM runners ORDER BY runner_id;
SELECT status, COUNT(*) AS count FROM outreach_messages GROUP BY status ORDER BY status;
SELECT status, qa_status, COUNT(*) AS count FROM prototypes GROUP BY status, qa_status ORDER BY status, qa_status;
