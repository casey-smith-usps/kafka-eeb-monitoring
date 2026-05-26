# Azure Deployment Scripts

This document contains all the PowerShell and Bash scripts needed to deploy the Kafka Monitoring Dashboard to Azure.

## Prerequisites

```bash
# Install Azure CLI
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Login to Azure
az login

# Set subscription
az account set --subscription "Your-Subscription-Name"

# Install Azure Functions Core Tools
npm install -g azure-functions-core-tools@4 --unsafe-perm true
```

---

## 1. Infrastructure Deployment Script

Save as `deploy-infrastructure.sh`:

```bash
#!/bin/bash

# Configuration Variables
RESOURCE_GROUP="kafka-monitoring-rg"
LOCATION="eastus"
APP_NAME="kafka-monitoring"
STORAGE_ACCOUNT="${APP_NAME}storage"
FUNCTION_APP="${APP_NAME}-functions"
KEYVAULT_NAME="${APP_NAME}-vault"
SQL_SERVER="${APP_NAME}-sql"
SQL_DATABASE="${APP_NAME}-db"
APIM_NAME="${APP_NAME}-apim"
STATIC_WEB_APP="${APP_NAME}-web"
VNET_NAME="${APP_NAME}-vnet"
APP_INSIGHTS="${APP_NAME}-insights"

echo "Creating Azure resources for Kafka Monitoring Dashboard..."

# Create Resource Group
echo "Creating resource group..."
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION

# Create Storage Account (for Functions)
echo "Creating storage account..."
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS

# Create Application Insights
echo "Creating Application Insights..."
az monitor app-insights component create \
  --app $APP_INSIGHTS \
  --location $LOCATION \
  --resource-group $RESOURCE_GROUP \
  --application-type web

INSTRUMENTATION_KEY=$(az monitor app-insights component show \
  --app $APP_INSIGHTS \
  --resource-group $RESOURCE_GROUP \
  --query instrumentationKey -o tsv)

# Create Key Vault
echo "Creating Key Vault..."
az keyvault create \
  --name $KEYVAULT_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --enable-rbac-authorization false

# Create VNet
echo "Creating Virtual Network..."
az network vnet create \
  --name $VNET_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --address-prefix 10.0.0.0/16

# Create subnet for Functions
az network vnet subnet create \
  --name functions-subnet \
  --vnet-name $VNET_NAME \
  --resource-group $RESOURCE_GROUP \
  --address-prefixes 10.0.1.0/24

# Create App Service Plan (Premium for VNet integration)
echo "Creating App Service Plan..."
az functionapp plan create \
  --name "${FUNCTION_APP}-plan" \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku EP1 \
  --is-linux true

# Create Function App
echo "Creating Function App..."
az functionapp create \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --plan "${FUNCTION_APP}-plan" \
  --storage-account $STORAGE_ACCOUNT \
  --runtime node \
  --runtime-version 18 \
  --functions-version 4 \
  --os-type Linux

# Enable Managed Identity for Function App
echo "Enabling Managed Identity..."
az functionapp identity assign \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP

FUNCTION_IDENTITY=$(az functionapp identity show \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --query principalId -o tsv)

# Grant Function App access to Key Vault
echo "Granting Key Vault access to Function App..."
az keyvault set-policy \
  --name $KEYVAULT_NAME \
  --object-id $FUNCTION_IDENTITY \
  --secret-permissions get list

# Enable VNet integration
echo "Enabling VNet integration..."
az functionapp vnet-integration add \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --vnet $VNET_NAME \
  --subnet functions-subnet

# Configure Function App settings
echo "Configuring Function App settings..."
az functionapp config appsettings set \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --settings \
    "KEY_VAULT_NAME=$KEYVAULT_NAME" \
    "APPINSIGHTS_INSTRUMENTATIONKEY=$INSTRUMENTATION_KEY" \
    "APPLICATIONINSIGHTS_CONNECTION_STRING=InstrumentationKey=$INSTRUMENTATION_KEY"

# Create Azure SQL Server (Optional - if not using Supabase)
echo "Creating Azure SQL Server..."
read -sp "Enter SQL Admin Password: " SQL_PASSWORD
echo

az sql server create \
  --name $SQL_SERVER \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --admin-user sqladmin \
  --admin-password "$SQL_PASSWORD"

# Create SQL Database
az sql db create \
  --name $SQL_DATABASE \
  --server $SQL_SERVER \
  --resource-group $RESOURCE_GROUP \
  --service-objective S1

# Allow Azure services to access SQL Server
az sql server firewall-rule create \
  --name AllowAzureServices \
  --server $SQL_SERVER \
  --resource-group $RESOURCE_GROUP \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# Create Static Web App
echo "Creating Static Web App..."
az staticwebapp create \
  --name $STATIC_WEB_APP \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard

# Create API Management
echo "Creating API Management (this may take 30-45 minutes)..."
az apim create \
  --name $APIM_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --publisher-name "Your Company" \
  --publisher-email "admin@yourcompany.com" \
  --sku-name Developer

echo "✅ Infrastructure deployment complete!"
echo ""
echo "Resource Group: $RESOURCE_GROUP"
echo "Function App: $FUNCTION_APP"
echo "Key Vault: $KEYVAULT_NAME"
echo "Static Web App: $STATIC_WEB_APP"
echo "APIM: $APIM_NAME"
echo ""
echo "Next steps:"
echo "1. Add secrets to Key Vault using: ./add-secrets.sh"
echo "2. Deploy Azure Functions using: ./deploy-functions.sh"
echo "3. Configure Azure AD authentication"
echo "4. Deploy frontend to Static Web App"
```

---

## 2. Add Secrets to Key Vault

Save as `add-secrets.sh`:

```bash
#!/bin/bash

KEYVAULT_NAME="kafka-monitoring-vault"

echo "Adding secrets to Key Vault: $KEYVAULT_NAME"

# Prompt for secrets
read -p "Confluent API Key: " CONFLUENT_API_KEY
read -sp "Confluent API Secret: " CONFLUENT_API_SECRET
echo

read -p "Databricks Host (e.g., https://your-workspace.cloud.databricks.com): " DATABRICKS_HOST
read -sp "Databricks Token: " DATABRICKS_TOKEN
echo

read -p "Supabase URL: " SUPABASE_URL
read -sp "Supabase Service Role Key: " SUPABASE_KEY
echo

# Add secrets to Key Vault
echo "Adding secrets..."

az keyvault secret set \
  --vault-name $KEYVAULT_NAME \
  --name "CONFLUENT-API-KEY" \
  --value "$CONFLUENT_API_KEY"

az keyvault secret set \
  --vault-name $KEYVAULT_NAME \
  --name "CONFLUENT-API-SECRET" \
  --value "$CONFLUENT_API_SECRET"

az keyvault secret set \
  --vault-name $KEYVAULT_NAME \
  --name "DATABRICKS-HOST" \
  --value "$DATABRICKS_HOST"

az keyvault secret set \
  --vault-name $KEYVAULT_NAME \
  --name "DATABRICKS-TOKEN" \
  --value "$DATABRICKS_TOKEN"

az keyvault secret set \
  --vault-name $KEYVAULT_NAME \
  --name "SUPABASE-URL" \
  --value "$SUPABASE_URL"

az keyvault secret set \
  --vault-name $KEYVAULT_NAME \
  --name "SUPABASE-SERVICE-ROLE-KEY" \
  --value "$SUPABASE_KEY"

echo "✅ Secrets added successfully!"
```

---

## 3. Deploy Azure Functions

Save as `deploy-functions.sh`:

```bash
#!/bin/bash

FUNCTION_APP="kafka-monitoring-functions"
RESOURCE_GROUP="kafka-monitoring-rg"

echo "Deploying Azure Functions..."

# Navigate to functions directory
cd azure-functions

# Install dependencies
echo "Installing dependencies..."
npm install

# Deploy to Azure
echo "Deploying to Azure Function App: $FUNCTION_APP"
func azure functionapp publish $FUNCTION_APP --javascript

echo "✅ Functions deployed successfully!"

# Get Function URLs
echo ""
echo "Function URLs:"
az functionapp function show \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --function-name kafka-sync \
  --query "invokeUrlTemplate" -o tsv

az functionapp function show \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --function-name databricks-ai \
  --query "invokeUrlTemplate" -o tsv
```

---

## 4. Configure Azure AD App Registration

Save as `configure-azure-ad.sh`:

```bash
#!/bin/bash

APP_NAME="Kafka Monitoring Dashboard"
REDIRECT_URI="https://kafka-monitoring-web.azurestaticapps.net/auth/callback"

echo "Configuring Azure AD App Registration..."

# Create App Registration
APP_ID=$(az ad app create \
  --display-name "$APP_NAME" \
  --sign-in-audience "AzureADMyOrg" \
  --web-redirect-uris "$REDIRECT_URI" \
  --query appId -o tsv)

echo "App Registration created with Client ID: $APP_ID"

# Get Tenant ID
TENANT_ID=$(az account show --query tenantId -o tsv)
echo "Tenant ID: $TENANT_ID"

# Create client secret
CLIENT_SECRET=$(az ad app credential reset \
  --id $APP_ID \
  --append \
  --query password -o tsv)

echo "Client Secret: $CLIENT_SECRET"
echo "⚠️  Save this secret securely - it won't be shown again!"

# Add API permissions
echo "Adding Microsoft Graph permissions..."
GRAPH_APP_ID="00000003-0000-0000-c000-000000000000"
USER_READ_PERMISSION="e1fe6dd8-ba31-4d61-89e7-88639da4683d" # User.Read

az ad app permission add \
  --id $APP_ID \
  --api $GRAPH_APP_ID \
  --api-permissions "$USER_READ_PERMISSION=Scope"

# Grant admin consent (requires admin privileges)
echo "Granting admin consent..."
az ad app permission admin-consent --id $APP_ID

echo ""
echo "✅ Azure AD configuration complete!"
echo ""
echo "Add these to your frontend environment variables:"
echo "VITE_AZURE_CLIENT_ID=$APP_ID"
echo "VITE_AZURE_TENANT_ID=$TENANT_ID"
echo "VITE_AZURE_AUTHORITY=https://login.microsoftonline.com/$TENANT_ID"
```

---

## 5. Deploy Frontend to Static Web App

Save as `deploy-frontend.sh`:

```bash
#!/bin/bash

STATIC_WEB_APP="kafka-monitoring-web"
RESOURCE_GROUP="kafka-monitoring-rg"

echo "Deploying frontend to Azure Static Web App..."

# Get deployment token
DEPLOYMENT_TOKEN=$(az staticwebapp secrets list \
  --name $STATIC_WEB_APP \
  --resource-group $RESOURCE_GROUP \
  --query "properties.apiKey" -o tsv)

# Build frontend
echo "Building frontend..."
npm run build

# Deploy using Static Web Apps CLI
echo "Deploying..."
npx @azure/static-web-apps-cli deploy \
  --deployment-token $DEPLOYMENT_TOKEN \
  --app-location "." \
  --output-location "dist"

echo "✅ Frontend deployed successfully!"

# Get URL
APP_URL=$(az staticwebapp show \
  --name $STATIC_WEB_APP \
  --resource-group $RESOURCE_GROUP \
  --query "defaultHostname" -o tsv)

echo ""
echo "Application URL: https://$APP_URL"
```

---

## 6. Complete Deployment Script

Save as `deploy-all.sh`:

```bash
#!/bin/bash

set -e  # Exit on error

echo "======================================"
echo "Kafka Monitoring Dashboard"
echo "Azure Complete Deployment"
echo "======================================"
echo ""

# Make scripts executable
chmod +x deploy-infrastructure.sh
chmod +x add-secrets.sh
chmod +x deploy-functions.sh
chmod +x configure-azure-ad.sh
chmod +x deploy-frontend.sh

# Step 1: Deploy infrastructure
echo "Step 1: Deploying Azure Infrastructure..."
./deploy-infrastructure.sh

echo ""
read -p "Press Enter to continue to Step 2 (Add Secrets)..."

# Step 2: Add secrets
echo "Step 2: Adding secrets to Key Vault..."
./add-secrets.sh

echo ""
read -p "Press Enter to continue to Step 3 (Configure Azure AD)..."

# Step 3: Configure Azure AD
echo "Step 3: Configuring Azure AD..."
./configure-azure-ad.sh

echo ""
read -p "Press Enter to continue to Step 4 (Deploy Functions)..."

# Step 4: Deploy Functions
echo "Step 4: Deploying Azure Functions..."
./deploy-functions.sh

echo ""
read -p "Press Enter to continue to Step 5 (Deploy Frontend)..."

# Step 5: Deploy Frontend
echo "Step 5: Deploying Frontend..."
./deploy-frontend.sh

echo ""
echo "======================================"
echo "✅ Deployment Complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Assign user roles in Azure AD"
echo "2. Configure APIM policies"
echo "3. Test the application"
echo "4. Setup monitoring alerts"
```

---

## 7. Cleanup Script (for testing)

Save as `cleanup.sh`:

```bash
#!/bin/bash

RESOURCE_GROUP="kafka-monitoring-rg"

read -p "Are you sure you want to delete all resources in $RESOURCE_GROUP? (yes/no): " CONFIRM

if [ "$CONFIRM" = "yes" ]; then
  echo "Deleting resource group..."
  az group delete --name $RESOURCE_GROUP --yes --no-wait
  echo "✅ Deletion initiated (running in background)"
else
  echo "Cleanup cancelled"
fi
```

---

## PowerShell Equivalents (for Windows)

### Deploy Infrastructure (PowerShell)

Save as `deploy-infrastructure.ps1`:

```powershell
# Configuration
$resourceGroup = "kafka-monitoring-rg"
$location = "eastus"
$appName = "kafka-monitoring"

Write-Host "Creating Azure resources..." -ForegroundColor Green

# Create Resource Group
az group create --name $resourceGroup --location $location

# Create Storage Account
az storage account create `
  --name "$($appName)storage" `
  --resource-group $resourceGroup `
  --location $location `
  --sku Standard_LRS

# Create Application Insights
az monitor app-insights component create `
  --app "$appName-insights" `
  --location $location `
  --resource-group $resourceGroup `
  --application-type web

# Continue with remaining resources...
Write-Host "Infrastructure deployment complete!" -ForegroundColor Green
```

---

## Quick Start Guide

1. **Make scripts executable:**
   ```bash
   chmod +x *.sh
   ```

2. **Run complete deployment:**
   ```bash
   ./deploy-all.sh
   ```

3. **Or run individual steps:**
   ```bash
   ./deploy-infrastructure.sh
   ./add-secrets.sh
   ./configure-azure-ad.sh
   ./deploy-functions.sh
   ./deploy-frontend.sh
   ```

4. **Monitor deployment:**
   ```bash
   az monitor activity-log list --resource-group kafka-monitoring-rg
   ```

5. **View logs:**
   ```bash
   az functionapp log tail --name kafka-monitoring-functions --resource-group kafka-monitoring-rg
   ```

---

## Troubleshooting

### Function deployment fails
```bash
# Check Function App logs
az functionapp log tail --name kafka-monitoring-functions --resource-group kafka-monitoring-rg

# Restart Function App
az functionapp restart --name kafka-monitoring-functions --resource-group kafka-monitoring-rg
```

### Key Vault access denied
```bash
# Verify Managed Identity has access
az keyvault show --name kafka-monitoring-vault --query properties.accessPolicies
```

### APIM not responding
```bash
# Check APIM status (creation takes 30-45 minutes)
az apim show --name kafka-monitoring-apim --resource-group kafka-monitoring-rg --query provisioningState
```

---

## Cost Management

```bash
# View current costs
az consumption usage list --start-date 2024-01-01 --end-date 2024-01-31

# Set budget alert
az consumption budget create \
  --amount 500 \
  --budget-name kafka-monitoring-budget \
  --category Cost \
  --time-grain Monthly \
  --time-period start=2024-01-01 end=2024-12-31
```
