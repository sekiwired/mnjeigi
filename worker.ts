const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const ipLog = new Map();

const LIMITS = {
  name: 200,
  email: 254,
  phone: 50,
  company: 200,
  topic: 200,
  message: 5000,
};

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function isRateLimited(ip) {
  const now = Date.now();
  const timestamps = (ipLog.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT) return true;
  timestamps.push(now);
  ipLog.set(ip, timestamps);
  return false;
}

export default {
  async fetch(request, env, ctx) {
    const allowedOrigin = env.ALLOWED_ORIGIN || "*";

    function corsResponse(bodyObj, status) {
      return new Response(bodyObj ? JSON.stringify(bodyObj) : null, {
        status,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": allowedOrigin,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (request.method === "OPTIONS") {
      return corsResponse(null, 204);
    }

    if (request.method !== "POST") {
      return corsResponse({ error: "Method not allowed" }, 405);
    }

    // Rate limiting
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    if (isRateLimited(ip)) {
      return corsResponse({ error: "Too many requests" }, 429);
    }

    let data;
    try {
      data = await request.json();
    } catch (e) {
      return corsResponse({ error: "Invalid JSON" }, 400);
    }

    const { name, email, phone, company, topic, message } = data;

    if (!name || !message || !(email || phone)) {
      return corsResponse({ error: "Missing fields" }, 400);
    }

    // Length limits
    for (const [field, max] of Object.entries(LIMITS)) {
      if (data[field] && String(data[field]).length > max) {
        return corsResponse({ error: `${field} too long` }, 400);
      }
    }

    // Basic email format check
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return corsResponse({ error: "Invalid email format" }, 400);
    }

    // Escape all inputs for HTML email
    const eName = escapeHtml(name);
    const eEmail = escapeHtml(email);
    const ePhone = escapeHtml(phone);
    const eCompany = escapeHtml(company);
    const eTopic = escapeHtml(topic);
    const eMessage = escapeHtml(message).replace(/\n/g, "<br/>");

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Website Contact <${env.CONTACT_EMAIL}>`,
        to: env.CONTACT_EMAIL,
        subject: eTopic
          ? `[${eTopic}] New message from ${eName}`
          : `New contact form message from ${eName}`,
        text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\nCompany: ${company}\nTopic: ${topic}\nMessage:\n${message}`,
        html: `<p><strong>Name:</strong> ${eName}<br/>
               <strong>Email:</strong> ${eEmail}<br/>
               <strong>Phone:</strong> ${ePhone}<br/>
               <strong>Company:</strong> ${eCompany}<br/>
               <strong>Topic:</strong> ${eTopic}<br/>
               <strong>Message:</strong><br/>${eMessage}</p>`,
      }),
    });

    const result = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend error:", result);
      return corsResponse({ success: false, error: "Service failed" }, 502);
    }

    return corsResponse({ success: true }, 200);
  },
};
