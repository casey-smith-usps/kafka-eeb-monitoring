import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailRequest {
  to: string;
  fullName: string;
  role: string;
  password: string;
  dashboardUrl: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { to, fullName, role, password, dashboardUrl }: EmailRequest = await req.json();

    if (!to || !fullName || !role || !password || !dashboardUrl) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const roleDescription = {
      admin: "Full access to manage users and all data",
      editor: "Can create, edit, and delete topics and incidents",
      viewer: "Read-only access to view all information",
    }[role] || "Access to the dashboard";

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
    .credentials-box { background: white; border: 2px solid #e5e7eb; padding: 15px; border-radius: 6px; margin: 15px 0; }
    .credential-item { font-family: monospace; word-break: break-all; margin: 8px 0; }
    .info-box { background: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 15px 0; border-radius: 4px; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to Kafka EEB Monitoring</h1>
    </div>
    <div class="content">
      <p>Hello <strong>${fullName}</strong>,</p>

      <p>You have been granted access to the <strong>Kafka EEB Monitoring Dashboard</strong> with <strong>${role}</strong> privileges.</p>

      <div class="info-box">
        <strong>Your Role: ${role.charAt(0).toUpperCase() + role.slice(1)}</strong><br>
        ${roleDescription}
      </div>

      <h3>Your Login Credentials:</h3>

      <div class="credentials-box">
        <div class="credential-item"><strong>Dashboard URL:</strong> <a href="${dashboardUrl}">${dashboardUrl}</a></div>
        <div class="credential-item"><strong>Email:</strong> ${to}</div>
        <div class="credential-item"><strong>Password:</strong> ${password}</div>
      </div>

      <a href="${dashboardUrl}" class="button">Access Dashboard Now</a>

      <div class="info-box">
        <strong>⚠️ Important:</strong> Save your password securely! After your first login, you can change your password. Your session will stay active, so you won't need to log in every time you open the dashboard.
      </div>

      <h3>What You Can Do:</h3>
      <ul>
        ${role === 'admin' ? '<li>Manage users and access control</li>' : ''}
        ${role === 'admin' || role === 'editor' ? '<li>Create and edit Kafka topics</li>' : ''}
        ${role === 'admin' || role === 'editor' ? '<li>Manage incidents and alerts</li>' : ''}
        <li>View real-time Kafka metrics and monitoring data</li>
        <li>Access documentation and architecture diagrams</li>
        <li>${role === 'viewer' ? 'View all data (read-only access)' : 'Full collaboration features'}</li>
      </ul>

      <p>If you have any questions or need assistance, please contact your administrator.</p>

      <p>Best regards,<br><strong>Kafka EEB Monitoring Team</strong></p>
    </div>
    <div class="footer">
      <p>This is an automated email. Please do not reply to this message.</p>
    </div>
  </div>
</body>
</html>
`;

    const emailText = `
Welcome to Kafka EEB Monitoring Dashboard

Hello ${fullName},

You have been granted access to the Kafka EEB Monitoring Dashboard with ${role} privileges.

Your Login Credentials:
Dashboard: ${dashboardUrl}
Email: ${to}
Password: ${password}

IMPORTANT: Save your password securely! You can change it after your first login. Your session will stay active, so you won't need to re-enter credentials every time you open the dashboard.

Role: ${role.charAt(0).toUpperCase() + role.slice(1)}
${roleDescription}

If you have any questions or need assistance, please contact your administrator.

Best regards,
Kafka EEB Monitoring Team
`;

    console.log("Email function called - returning manual template instructions");

    return new Response(
      JSON.stringify({
        error: "Automated email not configured. Please use the manual email template.",
        instructions: "Click the 'Email' button in User Management to copy the email template.",
        manualTemplate: {
          dashboardUrl,
          email: to,
          password,
          emailText,
          emailHtml
        }
      }),
      {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred",
        fallback: "Please use the manual email template feature in User Management."
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
