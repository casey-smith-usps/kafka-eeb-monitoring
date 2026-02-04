import { ingestProjectsService } from '../services/database';

export const seedIngestProjects = async () => {
  const projects = [
    {
      title: "Breadcrumbs Ingest - source system sending directly to EEB.",
      status: "On Hold",
      prod_date: null,
      owner: "Masha",
      status2: "",
      tasks: "Need to reach out to intake to get status on this.",
      environment: null
    },
    {
      title: "RIPS UAP",
      status: null,
      prod_date: null,
      owner: "Sergei / Jing",
      status2: "Workflow working in SIT. PTR2 sent data in SIT, waiting on validations from consumers.",
      tasks: "Masha verifying if we recieved the latest DDL.",
      environment: "sit"
    },
    {
      title: "EDW Mapping",
      status: null,
      prod_date: null,
      owner: "Deborah / Masha",
      status2: "Waiting on PTR2 for 3 items. Steve Kenedy confirmed they don't need it util Q4 of 2026. Deborah followed up with PTR2 for update on 1/6. Waiting for reply.",
      tasks: "Still waiting to hear back from PTR2 1/16. Deborah following up 1/26, waiting for response.",
      environment: null
    },
    {
      title: "Jing to setup basic services in Azure",
      status: null,
      prod_date: null,
      owner: "Jesse",
      status2: "EEB and Postgres teams have submitted NCRBs. New EEB NCRB NCRB0068711 submitted 1/23. Postgres team still waiting on NCRB.",
      tasks: "Jesse created DEV CR for user accounts. Waiting on Postgres team to implement.",
      environment: "dev"
    },
    {
      title: "Force Majeure",
      status: null,
      prod_date: "2026-02-05",
      owner: "Franc / Liam",
      status2: "Have schemas for outbound created. ICDs updated. Will need to do E2E testing.",
      tasks: "SIT testing in progress 1/30.",
      environment: "sit"
    },
    {
      title: "PTR2 Configuration updates",
      status: null,
      prod_date: null,
      owner: "Jing",
      status2: "Waiting for response from PTR2. Jesse last followed up on 1/26.",
      tasks: "Elliot confirmed they are reviewing 1/26. Jesse to follow up if no response.",
      environment: null
    },
    {
      title: "API Invoicing (webhooks) - 3 different ingests which will likely all go to 1 outbound topic. Invoice team will consume, enhance data and send back to EEB. EEB will forward to UAP.",
      status: null,
      prod_date: null,
      owner: "Modeling",
      status2: "Inbound/Outbound ICDs ready for review.",
      tasks: "Deborah to upload ICDs by EOD 1/28. Can assign to Liam, expected dev completion by 2/3. Liam starting development 1/30.",
      environment: "dev"
    },
    {
      title: "IDS Monitoring",
      status: null,
      prod_date: null,
      owner: "Jeff",
      status2: "IDS monitors at record level but not volume level. EEB still needs to monitor volume.",
      tasks: "Need to verify volume per ingest for IDS, waiting on response. Sent email on 1/26, waiting for response. Will be scheduling meeting to discuss.",
      environment: null
    },
    {
      title: "Determining consumers for SASS",
      status: null,
      prod_date: null,
      owner: "Jingyu",
      status2: "Playbook has been update with volume. Need to verify consumers. IV PW, IME, SAMS are primary consumers which consume through LVP. PTR2 consumes directly from EEB.",
      tasks: "EEB should notifiy LVP (on-prem), who are consuming the topics. They will need to notify their consumers. Jingyu confirm who to contact for on-call for SASS, scheduling a meeting.",
      environment: null
    },
    {
      title: "IDS AFSM additional attributes",
      status: null,
      prod_date: null,
      owner: "Tate / Robert",
      status2: "Planning on pilot in January and updating all sites in March. Pending column descriptions from Marcel. Jing created schemas for what we have. ICD creation in progress.",
      tasks: "Finished as much as possible on ICD without Marcels input. IDS is working on this now 1/23. Recieved schemas from IDS on 1/29. Tate to review schemas / update ICDs.",
      environment: null
    },
    {
      title: "CKU Resizing and Cluster Linking for Azure",
      status: null,
      prod_date: null,
      owner: "Jing",
      status2: "SIT cluster linking setup in progress. Discuss with Jing on testing approach.",
      tasks: "CR CHG1224388 created, waiting on NIT to implement. Jesse to verify if this is complete.",
      environment: "sit"
    },
    {
      title: "ProgReg source schema updates with refreshId / refreshCnt",
      status: null,
      prod_date: null,
      owner: "Robert",
      status2: "Dev testing in progress. ICD updates complete, need permissions updates. Waiting to hear when ProgReg will start work.",
      tasks: "Can hold off on testing until we confirm when they will start.",
      environment: "dev"
    },
    {
      title: "3 Critical GCP Vulnerbilities",
      status: null,
      prod_date: null,
      owner: "Sergei",
      status2: "Splunk related critical vulnerbilities. Need to update version. Jesse to coordinate with Splunk team.",
      tasks: "Planning to implement 2/3 at 1:00 pm ET",
      environment: null
    },
    {
      title: "Reach out about CBPMAN tarriff data frequency",
      status: null,
      prod_date: null,
      owner: "Robert",
      status2: "Confirmed we will be receiving sparatic data",
      tasks: "Need Jing to turn off CBPMAN Tarriff on 2/3. Robert to let Ben Lewis know it will be turned off.",
      environment: null
    },
    {
      title: "Discuss signature image approach",
      status: null,
      prod_date: null,
      owner: "Jing / Masha",
      status2: "Need written approval from CASI / Privacy",
      tasks: "Need meeting with CASI, Privacy and PTR2 to get approval for short term fix. Masha asked PTR2 to setup meeting, waiting on response. Masha to follow up on 2/2.",
      environment: null
    },
    {
      title: "New Incident Tickets",
      status: null,
      prod_date: null,
      owner: "On-call",
      status2: "",
      tasks: "",
      environment: null
    },
    {
      title: "Monitoring Threshold Reviews",
      status: null,
      prod_date: null,
      owner: "On-call",
      status2: "",
      tasks: "",
      environment: null
    },
    {
      title: "On-call Feedback",
      status: null,
      prod_date: null,
      owner: "On-call",
      status2: "",
      tasks: "",
      environment: null
    },
    {
      title: "Facility changes approval from Paul",
      status: null,
      prod_date: null,
      owner: "Mounaim",
      status2: "Development in progress. Deborah to send facility changes to Alegria, Jason, Paul (data scientists)",
      tasks: "",
      environment: "dev"
    },
    {
      title: "RSS Facility table - long term approach",
      status: null,
      prod_date: null,
      owner: "Siva",
      status2: "Meeting scheduled for 2/2",
      tasks: "",
      environment: null
    },
    {
      title: "Hold Mail",
      status: null,
      prod_date: null,
      owner: "Robert",
      status2: "Add event code field to schema",
      tasks: "Waiting for CCC to determine additional field names to be sent",
      environment: null
    },
    {
      title: "Long term approach to image encryption",
      status: null,
      prod_date: null,
      owner: "Jing",
      status2: "Privacy said all images should be encrypted",
      tasks: "Need to discuss with CASI / Jim about architecture. Topic level encryption vs message level encryption. Wait until short term approach is approved.",
      environment: null
    },
    {
      title: "Informatica cutover",
      status: null,
      prod_date: null,
      owner: "Masha",
      status2: "Need to do E2E testing with UAP",
      tasks: "Need to coordinate with UAP. Should also get a list of all consumers of FEA. Need to get list of all consumers from NIT if possible.",
      environment: null
    }
  ];

  try {
    const results = await ingestProjectsService.bulkCreate(projects);
    console.log(`Successfully imported ${results.length} ingest projects`);
    return results;
  } catch (error) {
    console.error('Error seeding ingest projects:', error);
    throw error;
  }
};
