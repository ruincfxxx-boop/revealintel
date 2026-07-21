require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const Database = require('better-sqlite3');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize SQLite for Ultra-Fast Search
let sqliteDb = null;
try {
  sqliteDb = new Database(path.join(__dirname, 'logs.db'), { readonly: true, fileMustExist: false });
} catch (e) {
  console.log('[WARN] SQLite logs.db not found or failed to open.');
}
const PORT = 3000;

// Configuration
const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY || 'S28ZW76-7HR410G-HXNSKJ8-BJG2AEJ';
const NOWPAYMENTS_IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET || '+CEgt5JZqypZ65EkWj0O9SeZ9iYbud70';
const GMAIL_USER = process.env.GMAIL_USER || 'ruincfxxx@gmail.com';
const GMAIL_PASS = process.env.GMAIL_PASS || 'uuhyqrqwwcqtwrcl';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: GMAIL_USER, pass: GMAIL_PASS }
});

app.use(cors());
app.use(express.json());

// Global IP Logging Middleware
app.use((req, res, next) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  
  if (req.path === '/' || req.path === '/index.html') {
    logToFile('SITE_VISIT', `Landed on Homepage | IP: ${ip}`);
    logToDiscord('New Site Visitor 🌍', ``, 0x10b981, [
      { name: 'Path', value: req.path, inline: true },
      { name: 'IP Address', value: ip, inline: true }
    ]);
  } else if (req.path.startsWith('/api/')) {
    logToFile('API_REQUEST', `${req.method} ${req.path} | IP: ${ip}`);
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html', 'htm'] }));

// Removed duplicate Pool declaration
const pool = new Pool({
  host: 'aws-1-us-west-2.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.vtnazfgxygnpphgeebql',
  password: 'uA1ft0J_M0(`',
  ssl: { rejectUnauthorized: false }
});

// --- Logging Infrastructure ---
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1528703985832427562/KQdFvnmZdt32ul3MEJXLr2iaBmjPZnu0F7M-1-wka08FIv5eqZqDEAHweroZhq2f148T';

// Add your owner IPs and usernames here to prevent them from being logged
const EXCLUDED_IPS = ['127.0.0.1', '::1', 'your-ip-here']; 
const EXCLUDED_USERS = [
  'calvarys', 'admin', 'owner',
  '1515213214110060618', '542927955903512587', '1396962509168181308', 
  '815082198851387392', '1482505102601228441', '1220053148874575994'
];

function logToFile(event, details, force = false) {
  const isExcluded = EXCLUDED_IPS.some(ip => details.includes(ip)) || EXCLUDED_USERS.some(u => details.includes(u));
  if (isExcluded && !force) return;

  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${event}] ${details}\n`;
  fs.appendFileSync(path.join(__dirname, 'logs.txt'), logMessage);
}

async function logToDiscord(title, description, color = 0x60a5fa, fields = [], force = false, buttonUrl = null, buttonLabel = "View Details") {
  const allText = title + description + fields.map(f => f.value).join(' ');
  const isExcluded = EXCLUDED_IPS.some(ip => allText.includes(ip)) || EXCLUDED_USERS.some(u => allText.includes(u));
  if (isExcluded && !force) return;
  
  const payload = {
    embeds: [{
      title,
      description,
      color,
      fields,
      timestamp: new Date().toISOString()
    }]
  };
  
  // Add Discord Components (Type 2 = Button) if a URL is provided
  if (buttonUrl) {
    payload.components = [{
      type: 1, // ActionRow
      components: [{
        type: 2, // Button
        style: 5, // Link Button
        label: buttonLabel,
        url: buttonUrl
      }]
    }];
  }

  try {
    await axios.post(DISCORD_WEBHOOK_URL, payload);
  } catch (e) {
    console.error('Failed to log to Discord:', e.response?.data || e.message);
  }
}

// (Middleware moved to top to intercept static files)

// Helper to generate key string
function generateKeyString(email, plan) {
  let userPrefix = 'User';
  if (email && email.includes('@')) {
    userPrefix = email.split('@')[0];
  } else if (email && email !== 'Admin Generated') {
    userPrefix = email;
  }
  
  // Clean up prefix (preserve original case)
  userPrefix = userPrefix.replace(/[^a-zA-Z0-9]/g, '');
  if (!userPrefix) userPrefix = 'RAW';
  
  // Generate random characters (uppercase letters and numbers)
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let randomPart = '';
  for (let i = 0; i < 30; i++) {
    const randomIndex = crypto.randomInt(0, charset.length);
    randomPart += charset[randomIndex];
  }
  
  return `${userPrefix}-${randomPart}`;
}

// 1. ADMIN - Get Keys
app.get('/api/admin/keys', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM api_keys');
    const keys = result.rows.map(row => ({
      id: row.id,
      key: row.key,
      plan: row.plan,
      email: row.email,
      durationDays: row.duration_days,
      expires: row.expires ? parseInt(row.expires) : null,
      hwid: row.hwid,
      status: row.status,
      logs: row.logs,
      ip: row.ip,
      requests: row.requests
    }));
    res.json({ keys });
  } catch(e) {
    res.status(500).json({ error: 'DB Error' });
  }
});

// Contact Form Endpoint
app.post('/api/contact', async (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  logToDiscord(`New Contact Message ✉️`, `**Subject:** ${subject}`, 0x3b82f6, [
    { name: 'Name', value: name, inline: true },
    { name: 'Email', value: email, inline: true },
    { name: 'Message', value: message, inline: false }
  ], true);

  res.json({ success: true, message: 'Message sent successfully!' });
});

// 2. GENERATE - Admin Key Generator (No payment needed)
app.post('/api/generate', async (req, res) => {
  const { adminToken, plan, email, durationDays } = req.body;
  if (adminToken !== 'u9xMpsytG7XdNdVk8GHr') return res.status(403).json({error: 'Forbidden'});
  
  const newKey = {
    id: Date.now(),
    key: generateKeyString(email, plan),
    plan,
    email: email || 'Admin Generated',
    durationDays: parseInt(durationDays),
    expires: parseInt(durationDays) === 9999 ? null : Date.now() + (parseInt(durationDays) * 24 * 60 * 60 * 1000)
  };
  
  try {
    await pool.query(
      'INSERT INTO api_keys (id, key, plan, email, duration_days, expires) VALUES ($1, $2, $3, $4, $5, $6)',
      [newKey.id, newKey.key, newKey.plan, newKey.email, newKey.durationDays, newKey.expires]
    );

    if (email && email !== 'Admin Generated' && GMAIL_USER !== 'your_email@gmail.com') {
      try {
        await transporter.sendMail({
          from: `"Reveal Intelligence" <${GMAIL_USER}>`,
          to: email,
          subject: `Your Reveal ${plan} API Key`,
          html: `<h2>Welcome to Reveal Intelligence!</h2><p>Your API Key has been generated.</p><p>Your API Key is: <strong style="color:#4ade80;">${newKey.key}</strong></p><p>Keep this safe!</p>`
        });
        console.log(`[REAL EMAIL] Sent admin-generated key to ${email}`);
      } catch (e) {
        console.error('Admin Email failed to send:', e);
      }
    }

    res.json({ success: true, key: newKey });
  } catch (err) {
    console.error('Generate Error:', err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// Revoke Key
app.post('/api/revoke', async (req, res) => {
  const { adminToken, id } = req.body;
  if (adminToken !== 'u9xMpsytG7XdNdVk8GHr') return res.status(403).json({error: 'Forbidden'});
  if (!id) return res.status(400).json({error: 'Missing ID'});
  try {
    await pool.query('DELETE FROM api_keys WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Revoke Error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 3. CHECKOUT - Handle Crypto & Card
app.post('/api/checkout', async (req, res) => {
  const { email, plan, method, discordId } = req.body;
  if (!email || !plan || !method) return res.status(400).json({error: 'Missing fields'});

  const prices = { 
    'Plus': 10, 
    'Plus-lifetime': 45,
    'Pro': 25, 
    'Pro-lifetime': 75,
    'Enterprise': 999 
  };
  const price = prices[plan] || 0;
  const dIdSafe = discordId ? ` | Discord: ${discordId}` : '';

  if (method === 'crypto' && NOWPAYMENTS_API_KEY !== 'your_nowpayments_api_key') {
    try {
      // Call NowPayments API
      const response = await axios.post('https://api.nowpayments.io/v1/invoice', {
        price_amount: price,
        price_currency: 'usd',
        order_id: `RAW-${Date.now()}`,
        order_description: `${plan} Plan Access${dIdSafe}`,
        ipn_callback_url: 'https://yourdomain.com/api/webhook/nowpayments',
        success_url: 'https://yourdomain.com/success.html',
        cancel_url: 'https://yourdomain.com/cancel.html',
        customer_email: email
      }, {
        headers: { 'x-api-key': NOWPAYMENTS_API_KEY, 'Content-Type': 'application/json' }
      });
      
      logToFile('CHECKOUT_INIT', `Plan: ${plan} | Email: ${email}${dIdSafe} | IP: ${req.ip || 'unknown'}`);
      
      return res.json({ redirect: response.data.invoice_url });
    } catch (error) {
      console.error('NowPayments Error:', error);
      return res.status(500).json({ error: 'Failed to generate crypto invoice.' });
    }
  } else if (method === 'crypto') {
    return res.status(400).json({ error: 'Crypto payments are currently disabled or unconfigured.' });
  } else if (method === 'card') {
    return res.status(400).json({ error: 'Credit Card payments are currently disabled. Please use Crypto.' });
  }

  return res.status(400).json({ error: 'Invalid payment method.' });
});

// 3.5 NOWPAYMENTS WEBHOOK
app.post('/api/webhook/nowpayments', async (req, res) => {
  const sig = req.headers['x-nowpayments-sig'];
  if (!sig) return res.status(400).send('No signature');

  // Verify HMAC signature
  const hmac = crypto.createHmac('sha512', NOWPAYMENTS_IPN_SECRET);
  hmac.update(JSON.stringify(req.body, Object.keys(req.body).sort()));
  const signature = hmac.digest('hex');

  if (signature !== sig) return res.status(401).send('Invalid signature');

  const { payment_status, order_id, order_description, customer_email } = req.body;

  if (payment_status === 'finished') {
    const descParts = order_description.split(' | Discord: ');
    const plan = descParts[0].split(' ')[0]; // Extract "Plus" from "Plus Plan Access"
    const discordId = descParts[1] || 'None';
    
    let durationDays = 30;
    let expires = Date.now() + (30 * 24 * 60 * 60 * 1000);
    if (plan.toLowerCase().includes('lifetime')) {
      durationDays = 9999;
      expires = null;
    }

    const newKey = {
      id: Date.now(),
      key: generateKeyString(customer_email, plan),
      plan,
      email: customer_email,
      durationDays,
      expires
    };

    await pool.query(
      'INSERT INTO api_keys (id, key, plan, email, duration_days, expires) VALUES ($1, $2, $3, $4, $5, $6)',
      [newKey.id, newKey.key, newKey.plan, newKey.email, newKey.durationDays, newKey.expires]
    );

    logToFile('PURCHASE_REAL', `Plan: ${plan} | Email: ${customer_email} | Discord: ${discordId} | Key: ${newKey.key}`);
    logToDiscord('New Purchase Completed 🚀', `A crypto payment was confirmed via NOWPayments.`, 0xf59e0b, [
      { name: 'Plan', value: plan, inline: true },
      { name: 'Email', value: customer_email, inline: true },
      { name: 'Discord ID', value: discordId, inline: true }
    ], false, "https://reveal.io", "View User");

    try {
      await transporter.sendMail({
        from: `"Reveal Intelligence" <${GMAIL_USER}>`,
        to: customer_email,
        subject: `Your Reveal ${plan} API Key`,
        html: `<h2>Payment Confirmed!</h2><p>Your API Key is: <strong style="color:#4ade80;">${newKey.key}</strong></p><p>Keep this safe!</p>`
      });
    } catch (e) {
      console.error('Webhook Email failed:', e);
    }
  }
  res.status(200).send('OK');
});

// --- Authentication & Security ---
const captchaStore = new Map();

app.get('/api/captcha', (req, res) => {
  const num1 = Math.floor(Math.random() * 10) + 1;
  const num2 = Math.floor(Math.random() * 10) + 1;
  const answer = num1 + num2;
  const id = Date.now().toString() + Math.random().toString();
  
  captchaStore.set(id, answer);
  setTimeout(() => captchaStore.delete(id), 5 * 60 * 1000); // Expires in 5 mins
  
  res.json({ id, question: `What is ${num1} + ${num2}?` });
});

// Claim Key
app.post('/api/claim', async (req, res) => {
  const { currentKey, newKey } = req.body;
  if (!currentKey || !newKey) {
    return res.status(400).json({ error: 'Missing currentKey or newKey.' });
  }

  try {
    // Get the current user's email based on their active key
    const resCurr = await pool.query('SELECT email FROM api_keys WHERE key = $1', [currentKey]);
    if (resCurr.rows.length === 0) return res.status(403).json({ error: 'Current API Key is invalid.' });
    const userEmail = resCurr.rows[0].email;

    // Verify the new key exists
    const resNew = await pool.query('SELECT * FROM api_keys WHERE key = $1', [newKey]);
    if (resNew.rows.length === 0) return res.status(404).json({ error: 'The key you entered does not exist.' });

    // Update the new key's email to match the user's account email
    await pool.query('UPDATE api_keys SET email = $1 WHERE key = $2', [userEmail, newKey]);

    res.json({ success: true, message: 'Key successfully claimed.' });
  } catch (err) {
    console.error('Claim Error:', err);
    res.status(500).json({ error: 'Database error while claiming key.' });
  }
});

app.post('/api/register', async (req, res) => {
  const { username, password, email, discordId, invite, captchaId, captchaAnswer } = req.body;
  if (!username || !password || !email || !captchaId || !captchaAnswer) {
    return res.status(400).json({ error: 'Missing required fields. Email is required.' });
  }
  
  const expected = captchaStore.get(captchaId);
  if (!expected || parseInt(captchaAnswer) !== expected) {
    return res.status(403).json({ error: 'Invalid Captcha.' });
  }
  captchaStore.delete(captchaId);
  
  const userEmail = email ? email : `${username}@local`;

  // Check if username already exists
  const resCheck = await pool.query('SELECT id FROM api_keys WHERE email = $1', [userEmail]);
  if (resCheck.rows.length > 0) {
    return res.status(409).json({ error: 'Username or Email already taken.' });
  }
  
  const currentIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  
  const newKey = {
    id: Date.now(),
    key: generateKeyString(userEmail, 'Free'),
    plan: 'Free',
    email: userEmail,
    durationDays: 365,
    expires: Date.now() + (365 * 24 * 60 * 60 * 1000),
    requests: 0,
    ip: currentIp
  };
  
  await pool.query(
    'INSERT INTO api_keys (id, key, plan, email, duration_days, expires, requests, ip) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [newKey.id, newKey.key, newKey.plan, newKey.email, newKey.durationDays, newKey.expires, newKey.requests, newKey.ip]
  );
  
  const dIdSafe = discordId || 'None';
  logToFile('SIGNUP_SUCCESS', `User: ${username} | Email: ${email} | Discord: ${dIdSafe} | Invite: ${invite || 'None'} | IP: ${currentIp}`, true);
  logToDiscord('New User Signed Up! 🥳', `A new free account was created.`, 0x10b981, [
    { name: 'Username', value: username, inline: true },
    { name: 'Email', value: email, inline: true },
    { name: 'Discord ID', value: dIdSafe, inline: true },
    { name: 'Invite Code', value: invite || 'None', inline: true },
    { name: 'IP Address', value: currentIp, inline: true }
  ], true, "https://reveal.io/admin", "Ban User");

  if (GMAIL_USER !== 'your_email@gmail.com') {
    try {
      await transporter.sendMail({
        from: `"Reveal Intelligence" <${GMAIL_USER}>`,
        to: email,
        subject: `Welcome to Reveal! Your Free API Key`,
        html: `<h2>Welcome to Reveal Intelligence, ${username}!</h2>
               <p>Your free tier account has been created successfully.</p>
               <p>Your API Key is: <strong style="color:#4ade80;">${newKey.key}</strong></p>
               <p>This key acts as your password to sign in to the dashboard.</p>
               <p>Keep this safe!</p>`
      });
      console.log(`[REAL EMAIL] Sent welcome email to ${email}`);
    } catch (e) {
      console.error('Welcome Email failed to send:', e);
    }
  }
  
  return res.json({ success: true, key: newKey.key, user: username });
});

app.post('/api/login', async (req, res) => {
  const { key, captchaId, captchaAnswer } = req.body;
  if (!key || !captchaId || !captchaAnswer) {
    return res.status(400).json({ error: 'Missing fields. Captcha and Key are required.' });
  }
  
  const expected = captchaStore.get(captchaId);
  if (!expected || parseInt(captchaAnswer) !== expected) {
    return res.status(403).json({ error: 'Invalid Captcha.' });
  }
  captchaStore.delete(captchaId);
  
  const resKey = await pool.query('SELECT * FROM api_keys WHERE key = $1', [key]);
  if (resKey.rows.length === 0) return res.status(403).json({ error: 'Invalid API Key.' });
  const validKey = resKey.rows[0];
  if (validKey.expires && validKey.expires < Date.now()) return res.status(403).json({ error: 'API Key expired.' });
  
  const currentIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  let locationStatus = 'known';
  
  const userPrefix = validKey.email.split('@')[0];
  const isOwner = EXCLUDED_USERS.includes(userPrefix) || EXCLUDED_IPS.includes(currentIp);

  if (!isOwner) {
    if (!validKey.ip) {
      await pool.query('UPDATE api_keys SET ip = $1 WHERE id = $2', [currentIp, validKey.id]);
    } else if (validKey.ip !== currentIp) {
      locationStatus = 'new';
    }
  }

  
  logToFile('LOGIN_SUCCESS', `User: ${userPrefix} | Location: ${locationStatus} | IP: ${currentIp}`);
  logToDiscord('User Logged In 🔑', ``, 0x60a5fa, [
    { name: 'User', value: userPrefix, inline: true },
    { name: 'IP Address', value: currentIp, inline: true },
    { name: 'Location Status', value: locationStatus, inline: true }
  ]);
  
  return res.json({ success: true, location: locationStatus, user: userPrefix });
});

// 4. SEARCH - Protected Route
app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  const userKey = req.query.key;

  if (!query || !userKey) {
    return res.status(400).json({ error: 'Query and Key are required.' });
  }

  // Blacklist specific IDs
  const blacklistedIDs = [
    '1396962509168181308',
    '1515213214110060618',
    '542927955903512587',
    '815082198851387392',
    '1482505102601228441',
    '1220053148874575994'
  ];
  if (blacklistedIDs.some(id => query.includes(id))) {
    return res.status(403).json({ error: 'This ID is blacklisted and cannot be searched.' });
  }

  // Validate Key
  const resKey = await pool.query('SELECT * FROM api_keys WHERE key = $1', [userKey]);
  if (resKey.rows.length === 0) {
    return res.status(403).json({ error: 'Invalid API Key.' });
  }
  const validKey = resKey.rows[0];

  if (validKey.expires && validKey.expires < Date.now()) {
    return res.status(403).json({ error: 'API Key has expired.' });
  }

  if (validKey.plan === 'Free') {
    return res.status(403).json({ error: 'Access Denied: Please upgrade your plan to access the search database.' });
  }
  
  // Track request
  await pool.query('UPDATE api_keys SET requests = COALESCE(requests, 0) + 1 WHERE id = $1', [validKey.id]);

  const currentIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  logToFile('SEARCH', `User: ${validKey.email.split('@')[0]} | Query: ${query} | IP: ${currentIp}`);
  logToDiscord('Search Executed 🔍', ``, 0x10b981, [
    { name: 'User', value: validKey.email.split('@')[0], inline: true },
    { name: 'Query', value: query, inline: true },
    { name: 'IP Address', value: currentIp, inline: true }
  ]);

  try {
    if (!sqliteDb) {
      try {
        sqliteDb = new Database(path.join(__dirname, 'logs.db'), { readonly: true, fileMustExist: true });
      } catch (e) {
        return res.status(500).json({ error: 'Search database is currently being built. Please try again later.' });
      }
    }

    // FTS5 MATCH query syntax handles tokenization
    // We escape double quotes to prevent syntax errors
    const safeQuery = query.replace(/"/g, '""');
    const ftsQuery = `"${safeQuery}"`;

    const stmt = sqliteDb.prepare('SELECT filename as file, content as match FROM search_logs WHERE search_logs MATCH ? LIMIT 1000');
    const rows = stmt.all(ftsQuery);
    
    // Convert to exactly what the frontend expects
    const results = rows.map(r => ({
      file: r.file,
      match: r.match
    }));

    res.json({ results });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Internal server error while reading logs.' });
  }
});

// Claim Discord Key
app.post('/api/claim', async (req, res) => {
  const { currentKey, newKey } = req.body;
  
  if (!currentKey || !newKey) {
    return res.status(400).json({ error: 'Both keys are required.' });
  }
  
  try {
    // 1. Validate current key (must be a free tier key)
    const currRes = await pool.query('SELECT * FROM api_keys WHERE key = $1', [currentKey]);
    if (currRes.rows.length === 0) return res.status(404).json({ error: 'Current key is invalid.' });
    const currKeyData = currRes.rows[0];
    
    // 2. Validate new key (must exist and not be claimed by another IP/user yet)
    const newRes = await pool.query('SELECT * FROM api_keys WHERE key = $1', [newKey]);
    if (newRes.rows.length === 0) return res.status(404).json({ error: 'The new key is invalid or does not exist.' });
    const newKeyData = newRes.rows[0];
    
    if (newKeyData.ip && newKeyData.ip !== currKeyData.ip) {
       return res.status(403).json({ error: 'That key has already been claimed or is linked to another IP.' });
    }
    
    // 3. Link them! (Update the new key to have the old key's discord_id, ip, email, username if they exist)
    await pool.query(
      'UPDATE api_keys SET discord_id = $1, ip = $2, email = $3, username = $4 WHERE key = $5',
      [currKeyData.discord_id || null, currKeyData.ip || null, currKeyData.email || null, currKeyData.username || null, newKey]
    );
    
    // Optional: Delete the old free key or leave it. We'll delete it to clean up.
    await pool.query('DELETE FROM api_keys WHERE key = $1', [currentKey]);
    
    res.json({ success: true, message: 'Key successfully claimed!' });
    
  } catch (err) {
    console.error('Claim error:', err);
    res.status(500).json({ error: 'Database error claiming key.' });
  }
});

// ============================
// DISCORD OAUTH LOGIN
// ============================
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
function getDynamicRedirectUri(req) {
  if (process.env.DISCORD_REDIRECT_URI) {
    return process.env.DISCORD_REDIRECT_URI;
  }
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}/api/auth/discord/callback`;
}

app.get('/api/auth/discord', (req, res) => {
  const dynamicRedirectUri = getDynamicRedirectUri(req);
  const url = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(dynamicRedirectUri)}&response_type=code&scope=identify`;
  res.redirect(url);
});

// Web Admin Key Generation
app.post('/api/admin/genkey', async (req, res) => {
  const { adminKey, planType, durationDays, discordId } = req.body;
  if (!adminKey) return res.status(401).json({ error: 'No admin key provided' });
  
  try {
    const adminRes = await pool.query('SELECT plan FROM api_keys WHERE key = $1', [adminKey]);
    if (adminRes.rows.length === 0 || !['OWNER', 'ADMIN'].includes(adminRes.rows[0].plan.toUpperCase())) {
      return res.status(403).json({ error: 'Unauthorized. You are not an admin.' });
    }
    
    const newKey = `REV-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(durationDays || 30));
    
    await pool.query(
      'INSERT INTO api_keys (key, plan, expires_at, discord_id) VALUES ($1, $2, $3, $4)',
      [newKey, (planType || 'plus').toUpperCase(), expiresAt, discordId || null]
    );
    
    res.json({ key: newKey, expiresAt: expiresAt.toISOString().split('T')[0] });
  } catch (err) {
    console.error('Admin Gen Key Error:', err);
    res.status(500).json({ error: 'Database error while generating key.' });
  }
});

// User Discord Linking
app.post('/api/user/link-discord', async (req, res) => {
  const { key, discordId } = req.body;
  if (!key || !discordId) return res.status(400).json({ error: 'Key and Discord ID required' });
  
  try {
    const keyRes = await pool.query('SELECT * FROM api_keys WHERE key = $1', [key]);
    if (keyRes.rows.length === 0) return res.status(404).json({ error: 'Invalid key.' });
    
    await pool.query('UPDATE api_keys SET discord_id = $1 WHERE key = $2', [discordId, key]);
    res.json({ success: true });
  } catch (err) {
    console.error('Discord Link Error:', err);
    res.status(500).json({ error: 'Database error while linking.' });
  }
});

app.get('/api/auth/discord/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('No code provided');
  
  const dynamicRedirectUri = getDynamicRedirectUri(req);
  
  try {
    const params = new URLSearchParams();
    params.append('client_id', DISCORD_CLIENT_ID);
    params.append('client_secret', DISCORD_CLIENT_SECRET);
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', dynamicRedirectUri);

    const tokenRes = await axios.post('https://discord.com/api/oauth2/token', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    
    const userRes = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenRes.data.access_token}` }
    });
    
    const discordUser = userRes.data;
    
    // Check if there is an API key associated with this Discord ID
    const keyRes = await pool.query('SELECT * FROM api_keys WHERE discord_id = $1 OR email = $1', [discordUser.id]);
    
    if (keyRes.rows.length > 0) {
      // Log them in using this key!
      const userKey = keyRes.rows[0].key;
      res.send(`
        <script>
          localStorage.setItem('reveal_access_key', '${userKey}');
          window.location.href = '/dashboard';
        </script>
      `);
    } else {
      res.send(`
        <script>
          alert('No API key found linked to this Discord account. If the bot generated one for you, use the Claim Key tab first!');
          window.location.href = '/';
        </script>
      `);
    }
    
  } catch (err) {
    console.error('Discord Auth Error:', err.response?.data || err.message);
    const errorDetails = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    res.status(500).send(`Discord Authentication Failed.<br><br><b>Exact Error from Discord:</b> ${errorDetails}<br><br>Check your .env file and ensure DISCORD_REDIRECT_URI exactly matches what is in the Discord Developer Portal.`);
  }
});

// 5. Clean Expired Keys Periodically
setInterval(async () => {
  const now = Date.now();
  const resDel = await pool.query('DELETE FROM api_keys WHERE expires IS NOT NULL AND expires < $1', [now]);
  if (resDel.rowCount > 0) {
    console.log(`[CLEANUP] Removed ${resDel.rowCount} expired keys.`);
  }
}, 60 * 60 * 1000);

if (require.main === module) {
  // Start Discord Bot if token exists
  require('dotenv').config(); // Ensure dotenv is loaded if they use .env
  const { startBot } = require('./bot');
  startBot(pool, generateKeyString, process.env.DISCORD_BOT_TOKEN);

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
module.exports = app;
