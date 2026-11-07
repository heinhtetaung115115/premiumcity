// Cloudflare Email Worker for pcity.online
// Paste this into: Cloudflare → pcity.online → Email → Email Routing →
// Email Workers → Create. Then route codes@pcity.online to this worker.
//
// Settings → Variables (secret): PANEL_INBOUND_SECRET = same value as in Vercel.

export default {
  async email(message, env) {
    const raw = await new Response(message.raw).text();
    const res = await fetch('https://pcity.online/api/panel/inbound', {
      method: 'POST',
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'x-panel-secret': env.PANEL_INBOUND_SECRET,
        'x-envelope-from': message.from,
        'x-envelope-to': message.to,
      },
      body: raw,
    });
    if (!res.ok) {
      console.log('panel inbound failed', res.status, await res.text());
    }
  },
};
