export default {
    async fetch(request, env, ctx) {

      if (request.method === "OPTIONS") {
        return corsResponse(null, 204);
      }

      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
      }

      let data;
      try {
        data = await request.json();
      } catch (e) {
        return new Response("Invalid JSON", { status: 400 });
      }

      const { name, email, phone, company, topic, message } = data;

      if (!name || !message || !(email || phone)) {
        return new Response("Missing fields", { status: 400 });
      }

      const escapedMessage = message
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br/>");

      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `Website Contact <${env.CONTACT_EMAIL}>`,
          to: env.CONTACT_EMAIL,
          subject: topic
            ? `[${topic}] New message from ${name}`
            : `New contact form message from ${name}`,
          text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\nCompany: ${company}\nTopic: ${topic}\nMessage:\n${message}`,
          html: `<p><strong>Name:</strong> ${name}<br/>
                 <strong>Email:</strong> ${email}<br/>
                 <strong>Phone:</strong> ${phone}<br/>
                 <strong>Company:</strong> ${company}<br/>
                 <strong>Topic:</strong> ${topic}<br/>
                 <strong>Message:</strong><br/>${escapedMessage}</p>`,
        }),
      });

      const result = await resendResponse.json();

      if (!resendResponse.ok) {
        console.error("Resend error:", result);
        return corsResponse({ success: false, error: "Service failed" }, 502);
      }

      return corsResponse({ success: true }, 200);

      function corsResponse(bodyObj, status) {
        return new Response(bodyObj ? JSON.stringify(bodyObj) : null, {
          status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      }
    },
  };