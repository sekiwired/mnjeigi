/**
 * Cloudflare Worker – lightweight analytics for user journey tracking.
 *
 * D1 binding: DB (run d1-schema.sql to create tables)
 * Environment variables:
 *   ANALYTICS_KEY – secret key to protect query endpoints
 *
 * Bot filtering: sessions where ALL page transitions < 2s are excluded from queries.
 */

const BOT_THRESHOLD_MS = 2000;

const BOT_FILTER_CTE = `
    WITH bot_sessions AS (
        SELECT session_id FROM (
            SELECT session_id,
                ts - LAG(ts) OVER (PARTITION BY session_id ORDER BY ts) as gap
            FROM page_views
        )
        GROUP BY session_id
        HAVING COUNT(*) > 1 AND MAX(gap) < ${BOT_THRESHOLD_MS}
    ),
    human_views AS (
        SELECT * FROM page_views
        WHERE session_id NOT IN (SELECT session_id FROM bot_sessions)
          AND ts > ?
    )`;

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const cors = {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: cors });
        }

        // ── Track page view ──
        if (url.pathname === '/track' && request.method === 'POST') {
            try {
                const { sid, page, ts, lang, ref } = await request.json();
                if (!sid || page === undefined || !ts) {
                    return new Response('Missing fields', { status: 400 });
                }
                await env.DB.prepare(
                    'INSERT INTO page_views (session_id, page, ts, referrer, lang) VALUES (?, ?, ?, ?, ?)'
                ).bind(sid, String(page), ts, ref || null, lang || null).run();
                return new Response(JSON.stringify({ ok: true }), { status: 200, headers: cors });
            } catch (e) {
                return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors });
            }
        }

        // ── Track card interaction ──
        if (url.pathname === '/card' && request.method === 'POST') {
            try {
                const { sid, topic, event_type, duration_ms, ts, lang } = await request.json();
                if (!sid || !topic || !event_type || !ts) {
                    return new Response('Missing fields', { status: 400 });
                }
                await env.DB.prepare(
                    'INSERT INTO card_events (session_id, topic, event_type, duration_ms, ts, lang) VALUES (?, ?, ?, ?, ?, ?)'
                ).bind(sid, topic, event_type, duration_ms || null, ts, lang || null).run();
                return new Response(JSON.stringify({ ok: true }), { status: 200, headers: cors });
            } catch (e) {
                return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors });
            }
        }

        // ── Query endpoints (protected by ANALYTICS_KEY) ──
        if (url.pathname.startsWith('/q/')) {
            const key = url.searchParams.get('key');
            if (key !== env.ANALYTICS_KEY) {
                return new Response('Unauthorized', { status: 401 });
            }
            const days = parseInt(url.searchParams.get('days') || '7');
            const since = Date.now() - days * 86400000;
            const route = url.pathname.replace('/q/', '');

            try {
                let data;
                switch (route) {

                    case 'funnel':
                        data = (await env.DB.prepare(`
                            ${BOT_FILTER_CTE}
                            SELECT page, COUNT(DISTINCT session_id) as sessions
                            FROM human_views
                            GROUP BY page ORDER BY page
                        `).bind(since).all()).results;
                        break;

                    case 'duration':
                        data = (await env.DB.prepare(`
                            ${BOT_FILTER_CTE}
                            SELECT page, CAST(AVG(duration) AS INTEGER) as avg_ms
                            FROM (
                                SELECT page,
                                    LEAD(ts) OVER (PARTITION BY session_id ORDER BY ts) - ts as duration
                                FROM human_views
                            )
                            WHERE duration IS NOT NULL AND duration > 0 AND duration < 600000
                            GROUP BY page ORDER BY page
                        `).bind(since).all()).results;
                        break;

                    case 'journeys': {
                        const limit = parseInt(url.searchParams.get('limit') || '50');
                        data = (await env.DB.prepare(`
                            ${BOT_FILTER_CTE}
                            SELECT session_id,
                                GROUP_CONCAT(page, ' > ') as journey,
                                MIN(ts) as started,
                                MAX(ts) - MIN(ts) as duration_ms,
                                COUNT(*) as pages,
                                MIN(lang) as lang
                            FROM human_views
                            GROUP BY session_id
                            ORDER BY started DESC LIMIT ?
                        `).bind(since, limit).all()).results;
                        break;
                    }

                    case 'dropoff':
                        data = (await env.DB.prepare(`
                            ${BOT_FILTER_CTE}
                            SELECT last_page as page, COUNT(*) as sessions
                            FROM (
                                SELECT session_id, page as last_page,
                                    ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY ts DESC) as rn
                                FROM human_views
                            ) WHERE rn = 1
                            GROUP BY last_page ORDER BY last_page
                        `).bind(since).all()).results;
                        break;

                    case 'stats': {
                        const counts = await env.DB.prepare(`
                            ${BOT_FILTER_CTE}
                            SELECT COUNT(DISTINCT session_id) as total_sessions,
                                   COUNT(*) as total_views
                            FROM human_views
                        `).bind(since).first();
                        const dur = await env.DB.prepare(`
                            ${BOT_FILTER_CTE}
                            SELECT CAST(AVG(dur) AS INTEGER) as avg_session_ms FROM (
                                SELECT session_id, MAX(ts) - MIN(ts) as dur
                                FROM human_views
                                GROUP BY session_id HAVING COUNT(*) > 1
                            )
                        `).bind(since).first();
                        data = [{
                            total_sessions: counts.total_sessions,
                            total_views: counts.total_views,
                            avg_pages: counts.total_sessions > 0
                                ? parseFloat((counts.total_views / counts.total_sessions).toFixed(1))
                                : 0,
                            avg_session_ms: dur?.avg_session_ms || 0
                        }];
                        break;
                    }

                    case 'cards':
                        data = (await env.DB.prepare(`
                            SELECT topic,
                                SUM(CASE WHEN event_type = 'hover' THEN 1 ELSE 0 END) as hovers,
                                SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END) as clicks,
                                CAST(AVG(CASE WHEN event_type = 'hover' THEN duration_ms END) AS INTEGER) as avg_hover_ms
                            FROM card_events
                            WHERE ts > ?
                            GROUP BY topic
                            ORDER BY clicks DESC, hovers DESC
                        `).bind(since).all()).results;
                        break;

                    default:
                        return new Response('Unknown query', { status: 404, headers: cors });
                }
                return new Response(JSON.stringify(data), { status: 200, headers: cors });
            } catch (e) {
                return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors });
            }
        }

        return new Response('Not Found', { status: 404 });
    }
};
