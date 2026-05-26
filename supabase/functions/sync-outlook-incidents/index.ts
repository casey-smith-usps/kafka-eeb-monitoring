import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ServiceNowEmail {
  subject: string;
  body: string;
  receivedDateTime: string;
  from: string;
}

interface ParsedIncident {
  incidentNumber: string;
  priority: number;
  businessService: string;
  category: string;
  subcategory: string;
  shortDescription: string;
  assignmentGroup: string;
  created: string;
  activityLog: any[];
}

function parseServiceNowEmail(email: ServiceNowEmail): ParsedIncident | null {
  try {
    const body = email.body;

    const incidentMatch = body.match(/Incident \(([^\)]+)\)/);
    if (!incidentMatch) return null;

    const incidentNumber = incidentMatch[1];

    const priorityMatch = body.match(/Priority\s+(\d+)\s+-\s+(\w+)/);
    let priority = 3;
    if (priorityMatch) {
      priority = parseInt(priorityMatch[1]);
    }

    const businessServiceMatch = body.match(/Business Service\s+([^\n]+)/);
    const businessService = businessServiceMatch ? businessServiceMatch[1].trim() : '';

    const categoryMatch = body.match(/Category\s+([^\n]+)/);
    const category = categoryMatch ? categoryMatch[1].trim() : '';

    const subcategoryMatch = body.match(/Subcategory\s+([^\n]+)/);
    const subcategory = subcategoryMatch ? subcategoryMatch[1].trim() : '';

    const shortDescMatch = body.match(/Short Description\s+([^\n]+)/);
    const shortDescription = shortDescMatch ? shortDescMatch[1].trim() : email.subject.replace('ServiceNow:', '').trim();

    const assignmentGroupMatch = body.match(/Assignment Group\s+([^\n]+)/);
    const assignmentGroup = assignmentGroupMatch ? assignmentGroupMatch[1].trim() : 'SDS Enterprise Event Broker';

    const createdMatch = body.match(/Created\s+([^\n]+)/);
    const created = createdMatch ? createdMatch[1].trim() : email.receivedDateTime;

    const activityLogSection = body.match(/Activity Log\s*_+\s*(.*?)\s*End of Activity Log/s);
    const activityLog: any[] = [];

    if (activityLogSection && activityLogSection[1]) {
      const entries = activityLogSection[1].split(/(?=\d{4}-\d{2}-\d{2})/);
      for (const entry of entries) {
        const match = entry.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+\w+)\s+-\s+([^\n]+)\s+Work Notes\s*([\s\S]+?)(?=\d{4}-\d{2}-\d{2}|$)/);
        if (match) {
          activityLog.push({
            timestamp: match[1],
            author: match[2].trim(),
            note: match[3].trim()
          });
        }
      }
    }

    return {
      incidentNumber,
      priority,
      businessService,
      category,
      subcategory,
      shortDescription,
      assignmentGroup,
      created,
      activityLog
    };
  } catch (error) {
    console.error('Error parsing email:', error);
    return null;
  }
}

function determineSeverity(priority: number): string {
  switch (priority) {
    case 1: return 'critical';
    case 2: return 'high';
    case 3: return 'medium';
    case 4: return 'low';
    default: return 'medium';
  }
}

function determineAlertType(category: string, subcategory: string): string {
  const cat = category.toLowerCase();
  const sub = subcategory.toLowerCase();

  if (sub.includes('schema') || cat.includes('schema')) {
    return 'schema_issue';
  }
  if (sub.includes('performance') || sub.includes('latency') || cat.includes('performance')) {
    return 'performance_degradation';
  }
  return 'manual';
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { accessToken } = await req.json();

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Microsoft Graph API access token required' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const graphUrl = 'https://graph.microsoft.com/v1.0/me/messages?$filter=from/emailAddress/address eq \'usps@servicenowservices.com\' and subject eq \'ServiceNow:\'&$top=50&$orderby=receivedDateTime desc';

    const graphResponse = await fetch(graphUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!graphResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch emails from Microsoft Graph API' }),
        { status: graphResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailData = await graphResponse.json();
    const emails = emailData.value || [];

    const processedIncidents = [];
    const errors = [];

    for (const email of emails) {
      const parsedIncident = parseServiceNowEmail({
        subject: email.subject,
        body: email.body?.content || '',
        receivedDateTime: email.receivedDateTime,
        from: email.from?.emailAddress?.address || ''
      });

      if (!parsedIncident) {
        continue;
      }

      const { data: existing } = await supabase
        .from('alerts')
        .select('id, activity_log')
        .eq('incident_number', parsedIncident.incidentNumber)
        .maybeSingle();

      const severity = determineSeverity(parsedIncident.priority);
      const alertType = determineAlertType(parsedIncident.category, parsedIncident.subcategory);

      if (existing) {
        const existingLog = existing.activity_log || [];
        const newLog = [...existingLog];

        for (const newEntry of parsedIncident.activityLog) {
          const exists = existingLog.some((e: any) =>
            e.timestamp === newEntry.timestamp && e.author === newEntry.author
          );
          if (!exists) {
            newLog.push(newEntry);
          }
        }

        const { error } = await supabase
          .from('alerts')
          .update({
            activity_log: newLog,
            last_updated: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (error) {
          errors.push({ incident: parsedIncident.incidentNumber, error: error.message });
        } else {
          processedIncidents.push({ incident: parsedIncident.incidentNumber, status: 'updated' });
        }
      } else {
        const { error } = await supabase
          .from('alerts')
          .insert({
            incident_number: parsedIncident.incidentNumber,
            priority: parsedIncident.priority,
            business_service: parsedIncident.businessService,
            category: parsedIncident.category,
            subcategory: parsedIncident.subcategory,
            title: `${parsedIncident.incidentNumber}: ${parsedIncident.shortDescription}`,
            description: parsedIncident.shortDescription,
            assignment_group: parsedIncident.assignmentGroup,
            alert_type: alertType,
            severity: severity,
            activity_log: parsedIncident.activityLog,
            email_source: email.subject,
            last_updated: new Date().toISOString(),
            resolved: false
          });

        if (error) {
          errors.push({ incident: parsedIncident.incidentNumber, error: error.message });
        } else {
          processedIncidents.push({ incident: parsedIncident.incidentNumber, status: 'created' });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedIncidents.length,
        incidents: processedIncidents,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error('Error syncing Outlook incidents:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
