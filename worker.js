// ================================================================
//  Telegram Sports Bot — Cloudflare Worker
//  Commands:
//    /willow       → all Willow matches as buttons
//    /fancode      → all Fancode matches as buttons
//    /sonyliv      → all SonyLIV matches as buttons
//    /willow1      → direct link to stream #1
//    /fancode3     → direct link to stream #3
//    /sonyliv1     → direct link to stream #1
//    /list         → all commands
//    /help         → usage guide
// ================================================================

const PLAYLISTS = {
  willow:  "https://raw.githubusercontent.com/srhady/willow-event/refs/heads/main/live_sports.m3u",
  fancode: "https://raw.githubusercontent.com/doctor-8trange/zyphx8/refs/heads/main/data/fancode.m3u",
  sonyliv: "https://raw.githubusercontent.com/drmlive/sliv-live-events/refs/heads/main/sonyliv.m3u"
};

// 5-minute cache so we don't hammer GitHub
let cache = { data: null, expiry: 0 };

// ---------- Parse M3U ----------
function parseM3U(content) {
  const lines = content.split('\n');
  const streams = [];
  let current = null;

  for (let line of lines) {
    line = line.trim();

    if (line.startsWith('#EXTINF:')) {
      const nameMatch  = line.match(/tvg-name="([^"]*)"/);
      const groupMatch = line.match(/group-title="([^"]*)"/);
      const logoMatch  = line.match(/tvg-logo="([^"]*)"/);

      // If there's no tvg-name, fall back to the text after the last comma
      let fallbackName = 'Unknown';
      const commaIdx = line.lastIndexOf(',');
      if (commaIdx !== -1) {
        fallbackName = line.substring(commaIdx + 1).trim() || 'Unknown';
      }

      current = {
        name:  nameMatch  ? nameMatch[1]  : fallbackName,
        group: groupMatch ? groupMatch[1] : '',
        logo:  logoMatch  ? logoMatch[1]  : '',
        url: '',
        drm: ''
      };
    } else if (line.startsWith('#KODIPROP:inputstream.adaptive.license_key=') && current) {
      current.drm = line.split('=')[1] || '';
    } else if (line && !line.startsWith('#') && current) {
      current.url = line;
      streams.push(current);
      current = null;
    }
  }
  return streams;
}

// ---------- Fetch + cache playlists ----------
async function getStreams() {
  const now = Date.now();
  if (cache.data && cache.expiry > now) return cache.data;

  const all = {};
  for (const [key, url] of Object.entries(PLAYLISTS)) {
    try {
      const res  = await fetch(url);
      const text = await res.text();
      all[key] = parseM3U(text);
    } catch (e) {
      all[key] = [];
    }
  }
  cache.data   = all;
  cache.expiry = now + 5 * 60 * 1000;
  return all;
}

// ---------- Telegram API helper ----------
async function tg(method, payload, env) {
  const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return r.json();
}

function shortLabel(name, max = 55) {
  if (name.length <= max) return name;
  return name.substring(0, max - 1) + '…';
}

function buildKeyboard(playlistKey, list) {
  return list.map((s, i) => ([{
    text: `${i + 1}. ${shortLabel(s.name)}`,
    callback_data: `s:${playlistKey}:${i}`
  }]));
}

function escapeMd(s) {
  return String(s).replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

// ================================================================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // -------- Register webhook --------
    if (url.pathname === '/registerWebhook') {
      const result = await tg('setWebhook', {
        url: `${url.origin}/webhook`,
        secret_token: env.BOT_SECRET,
        allowed_updates: ['message', 'callback_query']
      }, env);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // -------- Webhook --------
    if (url.pathname === '/webhook' && request.method === 'POST') {
      const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
      if (secret !== env.BOT_SECRET) return new Response('Unauthorized', { status: 401 });

      const update = await request.json();

      // ===== BUTTON TAP =====
      if (update.callback_query) {
        const cq     = update.callback_query;
        const chatId = cq.message.chat.id;
        const m      = (cq.data || '').match(/^s:([a-z]+):(\d+)$/);

        if (m) {
          const playlistKey = m[1];
          const index       = parseInt(m[2]);
          const streams     = await getStreams();
          const list        = streams[playlistKey] || [];
          const stream      = list[index];

          if (stream) {
            await tg('answerCallbackQuery', {
              callback_query_id: cq.id,
              text: 'Link sent below!'
            }, env);

            let msg = `📺 *${escapeMd(stream.name)}*\n`;
            if (stream.group) msg += `🏷 ${escapeMd(stream.group)}\n`;
            msg += `\n\`${stream.url}\``;
            if (stream.drm) msg += `\n\n🔑 \`${stream.drm}\``;

            await tg('sendMessage', {
              chat_id: chatId,
              text: msg,
              parse_mode: 'Markdown',
              disable_web_page_preview: true
            }, env);
          } else {
            await tg('answerCallbackQuery', {
              callback_query_id: cq.id,
              text: 'Stream not found'
            }, env);
          }
        }
        return new Response('OK');
      }

      // ===== TEXT MESSAGE =====
      if (!update.message) return new Response('OK');

      const chatId  = update.message.chat.id;
      const text    = update.message.text || '';
      const command = text.split(' ')[0].substring(1).toLowerCase();

      // ---- /start & /help ----
      if (command === 'start' || command === 'help') {
        const streams = await getStreams();
        let msg = '👋 *Sports Bot*\n\n';
        msg += 'Type a playlist name to see all matches:\n\n';
        for (const key of Object.keys(PLAYLISTS)) {
          msg += `• /${key} — ${streams[key].length} matches\n`;
        }
        msg += '\nDirect access: `/willow1`, `/fancode3`, `/sonyliv1`, etc.\n';
        msg += 'Use /list for the full command list.';

        await tg('sendMessage', {
          chat_id: chatId,
          text: msg,
          parse_mode: 'Markdown'
        }, env);
        return new Response('OK');
      }

      // ---- /list ----
      if (command === 'list') {
        const streams = await getStreams();
        let msg = '📋 *All Commands*\n\n';
        for (const [key, list] of Object.entries(streams)) {
          msg += `*${key.toUpperCase()}* (${list.length})\n`;
          list.forEach((s, i) => {
            msg += `  \`/${key}${i + 1}\` — ${escapeMd(shortLabel(s.name, 45))}\n`;
          });
          msg += '\n';
        }
        await tg('sendMessage', {
          chat_id: chatId,
          text: msg,
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        }, env);
        return new Response('OK');
      }

      // ---- /willow, /fancode, /sonyliv → buttons ----
      if (PLAYLISTS[command]) {
        const streams = await getStreams();
        const list    = streams[command] || [];

        if (!list.length) {
          await tg('sendMessage', {
            chat_id: chatId,
            text: `⚠️ No matches available in /${command} right now.`
          }, env);
          return new Response('OK');
        }

        const keyboard = buildKeyboard(command, list);
        await tg('sendMessage', {
          chat_id: chatId,
          text: `📺 *${command.toUpperCase()}* — ${list.length} match${list.length > 1 ? 'es' : ''}\n\nTap a match to get the stream link:`,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        }, env);
        return new Response('OK');
      }

      // ---- /willow1, /fancode3, /sonyliv1, etc. ----
      const m = command.match(/^([a-z]+)(\d+)$/);
      if (m) {
        const playlistKey = m[1];
        const index       = parseInt(m[2]) - 1;
        const streams     = await getStreams();
        const list        = streams[playlistKey] || [];

        if (list[index]) {
          const s = list[index];
          let msg = `📺 *${escapeMd(s.name)}*\n`;
          if (s.group) msg += `🏷 ${escapeMd(s.group)}\n`;
          msg += `\n\`${s.url}\``;
          if (s.drm) msg += `\n\n🔑 \`${s.drm}\``;

          await tg('sendMessage', {
            chat_id: chatId,
            text: msg,
            parse_mode: 'Markdown',
            disable_web_page_preview: true
          }, env);
        } else {
          await tg('sendMessage', {
            chat_id: chatId,
            text: `❌ Match #${index + 1} not found in /${playlistKey}.\nUse /${playlistKey} to see available matches.`
          }, env);
        }
        return new Response('OK');
      }

      // ---- Unknown ----
      await tg('sendMessage', {
        chat_id: chatId,
        text: `❌ Unknown command: /${command}\nTry /willow, /fancode or /sonyliv, or /help.`
      }, env);

      return new Response('OK');
    }

    return new Response('Bot running.', { status: 200 });
  }
};
