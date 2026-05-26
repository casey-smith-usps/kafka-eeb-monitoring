# Azure Migration Guide: Enterprise-Ready Deployment

This guide outlines how to migrate your Event-Driven Kafka Monitoring Dashboard to Azure infrastructure while maintaining all current functionality with enterprise-grade security.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Azure Cloud Environment                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐         ┌──────────────────────────────┐ │
│  │  Azure Static    │         │     Azure Front Door         │ │
│  │   Web Apps       │────────▶│  (CDN + WAF + DDoS)         │ │
│  │  (React Frontend)│         │                              │ │
│  └──────────────────┘         └──────────────────────────────┘ │
│           │                                                      │
│           │ HTTPS + Azure AD Token                              │
│           ▼                                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Azure API Management (APIM)                  │  │
│  │  • OAuth 2.0 / JWT validation                            │  │
│  │  • Rate limiting & throttling                            │  │
│  │  • Request logging & monitoring                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           Azure Functions (Premium Plan)                 │   │
│  │  ┌────────────────┬────────────────┬──────────────────┐ │   │
│  │  │ Kafka Sync     │ Databricks AI  │ Incident Sync    │ │   │
│  │  │ Function       │ Function       │ Function         │ │   │
│  │  └────────────────┴────────────────┴──────────────────┘ │   │
│  │                    VNet Integration                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│           │                                                      │
│           ├──────────────┬─────────────────┬──────────────┐    │
│           ▼              ▼                 ▼              ▼    │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ ┌────────┐│
│  │   Azure SQL  │ │  Databricks  │ │  Key Vault  │ │ Monitor││
│  │   Database   │ │  Workspace   │ │  (Secrets)  │ │ & Logs ││
│  │ (or Supabase)│ │              │ │             │ │        ││
│  └──────────────┘ └──────────────┘ └─────────────┘ └────────┘│
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Azure Active Directory (AAD)                 │  │
│  │  • Corporate SSO integration                             │  │
│  │  • Role-based access control (RBAC)                      │  │
│  │  • Conditional access policies                           │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Security Architecture

### 1. **Authentication Layer**
- **Azure AD Integration** for corporate SSO
- **Multi-factor authentication** (MFA) enforced
- **Conditional access policies** (device compliance, location-based)
- **JWT token validation** at API Gateway

### 2. **Network Security**
- **Azure Virtual Network (VNet)** for Functions
- **Private Endpoints** for databases and Databricks
- **Network Security Groups (NSG)** with strict firewall rules
- **Azure Front Door WAF** for DDoS and OWASP protection

### 3. **Data Protection**
- **Azure Key Vault** for all secrets and API keys
- **Managed Identity** for service-to-service authentication
- **Encryption at rest** (Azure SQL TDE, Key Vault)
- **Encryption in transit** (TLS 1.3)

### 4. **Compliance & Monitoring**
- **Azure Monitor** for centralized logging
- **Application Insights** for performance tracking
- **Azure Sentinel** for threat detection
- **Audit logs** for compliance (SOC 2, ISO 27001)

---

## Migration Steps

### Phase 1: Azure AD Authentication Setup

#### 1.1 Register Application in Azure AD

```bash
# Use Azure Portal or Azure CLI
az ad app create \
  --display-name "Kafka-Monitoring-Dashboard" \
  --sign-in-audience "AzureADMyOrg" \
  --web-redirect-uris "https://your-domain.azurestaticapps.net/auth/callback"
```

**Manual Steps:**
1. Go to Azure Portal → Azure Active Directory → App registrations
2. Click "New registration"
3. Configure:
   - **Name:** Kafka Monitoring Dashboard
   - **Supported account types:** Accounts in this organizational directory only
   - **Redirect URI:** `https://your-domain.azurestaticapps.net/auth/callback`
4. Note down:
   - **Application (client) ID**
   - **Directory (tenant) ID**
5. Create a client secret under "Certificates & secrets"

#### 1.2 Configure API Permissions

Add these permissions in Azure AD:
- **Microsoft Graph:**
  - `User.Read` (Read user profile)
  - `email` (Read user email)
  - `profile` (Read user profile)

#### 1.3 Define App Roles for RBAC

Add custom roles in App registration manifest:

```json
"appRoles": [
  {
    "allowedMemberTypes": ["User"],
    "description": "Administrators have full access",
    "displayName": "Admin",
    "id": "unique-guid-1",
    "isEnabled": true,
    "value": "admin"
  },
  {
    "allowedMemberTypes": ["User"],
    "description": "Editors can create and modify topics",
    "displayName": "Editor",
    "id": "unique-guid-2",
    "isEnabled": true,
    "value": "editor"
  },
  {
    "allowedMemberTypes": ["User"],
    "description": "Viewers have read-only access",
    "displayName": "Viewer",
    "id": "unique-guid-3",
    "isEnabled": true,
    "value": "viewer"
  }
]
```

---

### Phase 2: Frontend Deployment (Azure Static Web Apps)

#### 2.1 Create Static Web App

```bash
# Install Azure Static Web Apps CLI
npm install -g @azure/static-web-apps-cli

# Deploy
az staticwebapp create \
  --name kafka-monitoring-dashboard \
  --resource-group your-resource-group \
  --location eastus \
  --sku Standard
```

#### 2.2 Configure Build Settings

Create `.github/workflows/azure-static-web-apps.yml`:

```yaml
name: Azure Static Web Apps CI/CD

on:
  push:
    branches:
      - main
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches:
      - main

jobs:
  build_and_deploy_job:
    runs-on: ubuntu-latest
    name: Build and Deploy Job
    steps:
      - uses: actions/checkout@v3
        with:
          submodules: true

      - name: Build And Deploy
        id: builddeploy
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "/"
          api_location: ""
          output_location: "dist"
        env:
          VITE_AZURE_CLIENT_ID: ${{ secrets.VITE_AZURE_CLIENT_ID }}
          VITE_AZURE_TENANT_ID: ${{ secrets.VITE_AZURE_TENANT_ID }}
          VITE_API_BASE_URL: ${{ secrets.VITE_API_BASE_URL }}
```

#### 2.3 Environment Variables

Add to Azure Static Web Apps configuration:

```env
VITE_AZURE_CLIENT_ID=your-client-id
VITE_AZURE_TENANT_ID=your-tenant-id
VITE_AZURE_AUTHORITY=https://login.microsoftonline.com/your-tenant-id
VITE_API_BASE_URL=https://your-apim.azure-api.net
```

---

### Phase 3: Backend Deployment (Azure Functions)

#### 3.1 Create Function App

```bash
# Create Azure Function App (Premium Plan for VNet integration)
az functionapp create \
  --name kafka-monitoring-functions \
  --resource-group your-resource-group \
  --storage-account yourstorageaccount \
  --plan your-premium-plan \
  --runtime node \
  --runtime-version 18 \
  --functions-version 4
```

#### 3.2 Enable VNet Integration

```bash
# Create VNet
az network vnet create \
  --name kafka-monitoring-vnet \
  --resource-group your-resource-group \
  --address-prefix 10.0.0.0/16

# Create subnet for Functions
az network vnet subnet create \
  --name functions-subnet \
  --vnet-name kafka-monitoring-vnet \
  --resource-group your-resource-group \
  --address-prefixes 10.0.1.0/24

# Enable VNet integration
az functionapp vnet-integration add \
  --name kafka-monitoring-functions \
  --resource-group your-resource-group \
  --vnet kafka-monitoring-vnet \
  --subnet functions-subnet
```

#### 3.3 Configure Managed Identity

```bash
# Enable system-assigned managed identity
az functionapp identity assign \
  --name kafka-monitoring-functions \
  --resource-group your-resource-group
```

#### 3.4 Deploy Functions

Create Azure Functions from existing Supabase Edge Functions:

**File: `azure-functions/kafka-sync/function.json`**
```json
{
  "bindings": [
    {
      "authLevel": "function",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "methods": ["get", "post"]
    },
    {
      "type": "http",
      "direction": "out",
      "name": "res"
    }
  ]
}
```

**File: `azure-functions/kafka-sync/index.js`**
```javascript
const { app } = require('@azure/functions');
const { DefaultAzureCredential } = require('@azure/identity');
const { SecretClient } = require('@azure/keyvault-secrets');

app.http('kafka-sync', {
    methods: ['GET', 'POST'],
    authLevel: 'function',
    handler: async (request, context) => {
        try {
            // Get secrets from Key Vault using Managed Identity
            const credential = new DefaultAzureCredential();
            const vaultName = process.env.KEY_VAULT_NAME;
            const url = `https://${vaultName}.vault.azure.net`;
            const client = new SecretClient(url, credential);

            const confluentApiKey = await client.getSecret('CONFLUENT-API-KEY');
            const confluentApiSecret = await client.getSecret('CONFLUENT-API-SECRET');

            // Your Kafka sync logic here (from supabase/functions/sync-kafka-topics)

            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: true })
            };
        } catch (error) {
            context.error('Error in kafka-sync:', error);
            return {
                status: 500,
                body: JSON.stringify({ error: error.message })
            };
        }
    }
});
```

#### 3.5 Configure Application Settings

```bash
# Add Key Vault reference
az functionapp config appsettings set \
  --name kafka-monitoring-functions \
  --resource-group your-resource-group \
  --settings \
    "KEY_VAULT_NAME=your-keyvault-name" \
    "DATABRICKS_HOST=@Microsoft.KeyVault(SecretUri=https://your-vault.vault.azure.net/secrets/databricks-host/)" \
    "DATABRICKS_TOKEN=@Microsoft.KeyVault(SecretUri=https://your-vault.vault.azure.net/secrets/databricks-token/)"
```

---

### Phase 4: Database Options

#### Option A: Keep Supabase (Recommended for faster migration)

**Pros:**
- No database migration needed
- All RLS policies already configured
- Faster deployment

**Configuration:**
1. Create Private Endpoint for Supabase (if supported) or use IP whitelisting
2. Add Supabase connection string to Key Vault
3. Configure Azure Functions to access via VNet

#### Option B: Migrate to Azure SQL Database

**Pros:**
- Full Azure integration
- Better corporate compliance
- Native VNet integration

**Migration Steps:**

```bash
# Create Azure SQL Server
az sql server create \
  --name kafka-monitoring-sql \
  --resource-group your-resource-group \
  --location eastus \
  --admin-user sqladmin \
  --admin-password 'YourSecurePassword123!'

# Create database
az sql db create \
  --name kafka-monitoring-db \
  --server kafka-monitoring-sql \
  --resource-group your-resource-group \
  --service-objective S1

# Enable firewall for Azure services
az sql server firewall-rule create \
  --name AllowAzureServices \
  --server kafka-monitoring-sql \
  --resource-group your-resource-group \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

**Schema Migration:**
1. Export Supabase schema: Use migration files in `supabase/migrations/`
2. Convert PostgreSQL to T-SQL (minimal changes needed)
3. Import to Azure SQL Database
4. Implement Row Level Security using SQL Server features

---

### Phase 5: Azure Key Vault Setup

```bash
# Create Key Vault
az keyvault create \
  --name kafka-monitoring-vault \
  --resource-group your-resource-group \
  --location eastus

# Grant Function App access to Key Vault
FUNCTION_IDENTITY=$(az functionapp identity show \
  --name kafka-monitoring-functions \
  --resource-group your-resource-group \
  --query principalId -o tsv)

az keyvault set-policy \
  --name kafka-monitoring-vault \
  --object-id $FUNCTION_IDENTITY \
  --secret-permissions get list

# Add secrets
az keyvault secret set --vault-name kafka-monitoring-vault --name "CONFLUENT-API-KEY" --value "your-key"
az keyvault secret set --vault-name kafka-monitoring-vault --name "CONFLUENT-API-SECRET" --value "your-secret"
az keyvault secret set --vault-name kafka-monitoring-vault --name "DATABRICKS-HOST" --value "your-databricks-host"
az keyvault secret set --vault-name kafka-monitoring-vault --name "DATABRICKS-TOKEN" --value "your-token"
```

---

### Phase 6: API Management (APIM) Configuration

```bash
# Create APIM instance
az apim create \
  --name kafka-monitoring-apim \
  --resource-group your-resource-group \
  --publisher-name "Your Company" \
  --publisher-email admin@yourcompany.com \
  --sku-name Developer
```

**Configure APIM Policies:**

```xml
<policies>
    <inbound>
        <!-- Validate JWT token from Azure AD -->
        <validate-jwt header-name="Authorization" failed-validation-httpcode="401" failed-validation-error-message="Unauthorized">
            <openid-config url="https://login.microsoftonline.com/{tenant-id}/v2.0/.well-known/openid-configuration" />
            <audiences>
                <audience>api://{client-id}</audience>
            </audiences>
            <required-claims>
                <claim name="roles" match="any">
                    <value>admin</value>
                    <value>editor</value>
                    <value>viewer</value>
                </claim>
            </required-claims>
        </validate-jwt>

        <!-- Rate limiting -->
        <rate-limit calls="100" renewal-period="60" />

        <!-- CORS -->
        <cors allow-credentials="true">
            <allowed-origins>
                <origin>https://your-domain.azurestaticapps.net</origin>
            </allowed-origins>
            <allowed-methods>
                <method>GET</method>
                <method>POST</method>
                <method>PUT</method>
                <method>DELETE</method>
            </allowed-methods>
            <allowed-headers>
                <header>*</header>
            </allowed-headers>
        </cors>

        <base />
    </inbound>
    <backend>
        <base />
    </backend>
    <outbound>
        <base />
    </outbound>
    <on-error>
        <base />
    </on-error>
</policies>
```

---

### Phase 7: Monitoring & Observability

#### 7.1 Configure Application Insights

```bash
# Create Application Insights
az monitor app-insights component create \
  --app kafka-monitoring-insights \
  --location eastus \
  --resource-group your-resource-group \
  --application-type web

# Link to Function App
az functionapp config appsettings set \
  --name kafka-monitoring-functions \
  --resource-group your-resource-group \
  --settings "APPINSIGHTS_INSTRUMENTATIONKEY=your-instrumentation-key"
```

#### 7.2 Setup Alerts

```bash
# Alert for high error rate
az monitor metrics alert create \
  --name high-error-rate \
  --resource-group your-resource-group \
  --scopes /subscriptions/{subscription-id}/resourceGroups/your-resource-group/providers/Microsoft.Web/sites/kafka-monitoring-functions \
  --condition "count Http5xx > 10" \
  --window-size 5m \
  --evaluation-frequency 1m
```

---

## Cost Estimation

### Monthly Azure Costs (Approximate)

| Service | Tier | Cost |
|---------|------|------|
| Azure Static Web Apps | Standard | $9/month |
| Azure Functions | Premium (EP1) | $160/month |
| Azure SQL Database | S1 (20 DTU) | $30/month |
| Azure API Management | Developer | $50/month |
| Azure Key Vault | Standard | $0.03/10k ops |
| Application Insights | Pay-as-you-go | ~$10/month |
| Azure Front Door | Standard | $35/month + data |
| **Total Estimated** | | **~$294-350/month** |

**Cost Optimization Tips:**
- Use Azure Reservations for 1-year or 3-year commitments (30-60% savings)
- Scale down Functions during off-hours
- Use Azure SQL serverless tier for variable workloads

---

## Security Checklist

- [ ] Azure AD authentication configured
- [ ] MFA enforced for all users
- [ ] App roles assigned to users
- [ ] VNet integration enabled for Functions
- [ ] Private endpoints configured for databases
- [ ] All secrets stored in Key Vault
- [ ] Managed Identity enabled and configured
- [ ] APIM policies enforcing JWT validation
- [ ] WAF enabled on Azure Front Door
- [ ] TLS 1.3 enforced
- [ ] Audit logging enabled
- [ ] Application Insights monitoring active
- [ ] Alert rules configured
- [ ] Backup and disaster recovery plan tested

---

## Migration Timeline

### Week 1: Infrastructure Setup
- Create Azure resources
- Configure Azure AD
- Setup VNet and security groups

### Week 2: Backend Migration
- Deploy Azure Functions
- Configure Key Vault
- Setup APIM

### Week 3: Database Migration
- Migrate schema to Azure SQL (if chosen)
- Test data access and RLS
- Performance testing

### Week 4: Frontend Deployment
- Deploy to Azure Static Web Apps
- Configure Azure AD auth in frontend
- Integration testing

### Week 5: Testing & Validation
- Security testing
- Performance testing
- User acceptance testing

### Week 6: Go-Live
- Cutover to production
- Monitor and support

---

## Next Steps

1. **Review with Security Team:** Share this architecture with your corporate security team
2. **Get Azure Subscription:** Ensure you have proper Azure subscription and permissions
3. **Request Resources:** Submit requests for resource creation in your Azure tenant
4. **Plan Migration:** Schedule migration windows and coordinate with stakeholders

Would you like me to generate:
1. Azure Functions code migrated from your Supabase Edge Functions?
2. Azure AD authentication React components using MSAL?
3. Infrastructure-as-Code templates (ARM/Bicep/Terraform)?
