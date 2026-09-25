// Step 1 of the GitHub login for Decap CMS (/admin): send the user to GitHub.
// Needs GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET set in Vercel env vars.
const crypto = require('crypto');

module.exports = (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    res.statusCode = 500;
    res.end('GITHUB_CLIENT_ID is not configured.');
    return;
  }
  const state = crypto.randomBytes(16).toString('hex');
  const redirectUri = `https://${req.headers.host}/api/callback`;
  const url = 'https://github.com/login/oauth/authorize?' + new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'repo,user',
    state
  });
  res.setHeader('Set-Cookie', `decap_oauth_state=${state}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  res.statusCode = 302;
  res.setHeader('Location', url);
  res.end();
};
