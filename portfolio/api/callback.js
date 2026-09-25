// Step 2 of the GitHub login for Decap CMS: swap the code for a token and
// hand it back to the /admin window that opened this popup.
// JSON for embedding inside <script>: escape "<" so "</script>" can't break out.
const js = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

function page(status, payload, origin) {
  const message = `authorization:github:${status}:${JSON.stringify(payload)}`;
  return `<!doctype html><html><body><script>
(function () {
  var origin = ${js(origin)};
  function receive(e) {
    if (e.origin !== origin) return;
    window.opener.postMessage(${js(message)}, origin);
    window.removeEventListener('message', receive);
  }
  window.addEventListener('message', receive);
  window.opener.postMessage('authorizing:github', origin);
})();
</script></body></html>`;
}

function readCookie(req, name) {
  const match = (req.headers.cookie || '').match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? match[1] : null;
}

module.exports = async (req, res) => {
  const origin = `https://${req.headers.host}`;
  const { searchParams } = new URL(req.url, origin);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Set-Cookie', 'decap_oauth_state=; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=0');

  if (!code || !state || state !== readCookie(req, 'decap_oauth_state')) {
    res.statusCode = 400;
    res.end(page('error', { message: 'Login failed: invalid or expired state. Please try again.' }, origin));
    return;
  }

  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code
      })
    });
    const data = await response.json();
    if (!data.access_token) throw new Error(data.error_description || 'No access token returned');
    res.end(page('success', { token: data.access_token, provider: 'github' }, origin));
  } catch (err) {
    res.statusCode = 500;
    res.end(page('error', { message: err.message }, origin));
  }
};
