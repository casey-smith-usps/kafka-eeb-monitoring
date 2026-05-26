// Hardcoded Confluent Cluster Configurations
// DO NOT commit to public repositories - this contains sensitive credentials

export interface ClusterConfig {
  id: string;
  displayName: string;
  environment: 'dev' | 'sit' | 'cat' | 'prod';
  cloudProvider: 'GCP' | 'Azure';
  clusterId: string;
  restEndpoint: string;
  apiKey: string;
  apiSecret: string;
  schemaRegistryEndpoint: string;
  schemaApiKey: string;
  schemaApiSecret: string;
}

export const CLUSTER_CONFIGS: ClusterConfig[] = [
  // DEV Clusters
  {
    id: 'dev-azure',
    displayName: 'DEV Azure',
    environment: 'dev',
    cloudProvider: 'Azure',
    clusterId: 'lkc-33v902',
    restEndpoint: 'https://lkc-33v902.dom4gl8rd6w.eastus.azure.confluent.cloud',
    apiKey: 'XW3T6QRAT4VPGPUO',
    apiSecret: 'cfltvsREZFEb2Nleb17TvjSzNHZYD723W8fPIC2qBqlRKQ1Gg0EjJ7vXJaLz7mmA',
    schemaRegistryEndpoint: 'https://psrc-67zq6.us-east4.gcp.confluent.cloud',
    schemaApiKey: 'URC4AVTEVT7LGPDJ',
    schemaApiSecret: 'cflt+WYTC9sXDGiKywm/Lu62w6+OxFtaNPO4KAzo68Ut3lnvvMbcxEZgniOK0I6g',
  },
  {
    id: 'dev-gcp',
    displayName: 'DEV GCP',
    environment: 'dev',
    cloudProvider: 'GCP',
    clusterId: 'lkc-y9zr9j',
    restEndpoint: 'https://lkc-y9zr9j.domng65099w.us-east4.gcp.confluent.cloud',
    apiKey: 'LXZ4E35XIGTCQ2AR',
    apiSecret: 'cfltBYZZiWLu67mQwLi8Sajw+WgWd1TvNUaaBW5GMDllZfTs5Fai+EH5+YpYwLuQ',
    schemaRegistryEndpoint: 'https://psrc-67zq6.us-east4.gcp.confluent.cloud',
    schemaApiKey: 'URC4AVTEVT7LGPDJ',
    schemaApiSecret: 'cflt+WYTC9sXDGiKywm/Lu62w6+OxFtaNPO4KAzo68Ut3lnvvMbcxEZgniOK0I6g',
  },
  // SIT Clusters
  {
    id: 'sit-c1-gcp',
    displayName: 'SIT C1 GCP',
    environment: 'sit',
    cloudProvider: 'GCP',
    clusterId: 'lkc-6zkk3q',
    restEndpoint: 'https://lkc-6zkk3q.domng6dj5pk.us-central1.gcp.confluent.cloud',
    apiKey: 'V6ADS3SNJLJAPA23',
    apiSecret: 'cflt6HIr6r6H5vwcm7x/sx6aughD+u3UnattxVnG/1FLp9liMxMmtmPNtJoVB++g',
    schemaRegistryEndpoint: 'https://psrc-67zq6.us-east4.gcp.confluent.cloud',
    schemaApiKey: '636U4BMRZEPDCGH7',
    schemaApiSecret: 'cfltSCuAQUxYUU4p4CgdYasBc7Qomz6pujKDwCWcIqV0mWk0CWdBZPBOtfr1ATPQ',
  },
  {
    id: 'sit-azure',
    displayName: 'SIT Azure',
    environment: 'sit',
    cloudProvider: 'Azure',
    clusterId: 'lkc-q9212m',
    restEndpoint: 'https://lkc-q9212m.domzpn31ljw.eastus.azure.confluent.cloud',
    apiKey: 'VK6AOXBS26VWYOPD',
    apiSecret: 'cfltsTNhQhPEzwveuT/DyNDYSqf5JWTTRhhPMVb4h2whmkI0hPQVqsWcYLsjr/4g',
    schemaRegistryEndpoint: 'https://psrc-67zq6.us-east4.gcp.confluent.cloud',
    schemaApiKey: '636U4BMRZEPDCGH7',
    schemaApiSecret: 'cfltSCuAQUxYUU4p4CgdYasBc7Qomz6pujKDwCWcIqV0mWk0CWdBZPBOtfr1ATPQ',
  },
  {
    id: 'sit-e4-gcp',
    displayName: 'SIT E4 GCP',
    environment: 'sit',
    cloudProvider: 'GCP',
    clusterId: 'lkc-rkrr50',
    restEndpoint: 'https://lkc-rkrr50.domjg5j11w2.us-east4.gcp.confluent.cloud',
    apiKey: '2Z7QNKXFEWMZ5LR2',
    apiSecret: 'cfltmrCePUfn1b17C8G3FENwxyy9JpV6GnzpnmxhawvxqsTiR+sJ39AkXk7JcqPw',
    schemaRegistryEndpoint: 'https://psrc-67zq6.us-east4.gcp.confluent.cloud',
    schemaApiKey: '636U4BMRZEPDCGH7',
    schemaApiSecret: 'cfltSCuAQUxYUU4p4CgdYasBc7Qomz6pujKDwCWcIqV0mWk0CWdBZPBOtfr1ATPQ',
  },
  // CAT Clusters
  {
    id: 'cat-azure',
    displayName: 'CAT Azure',
    environment: 'cat',
    cloudProvider: 'Azure',
    clusterId: 'lkc-y3v5qj',
    restEndpoint: 'https://lkc-y3v5qj.domjpe57j0p.eastus.azure.confluent.cloud',
    apiKey: 'JIVNEVGD67O2BS3X',
    apiSecret: 'cfltCINYWUf4sV0OT4Aht8zKVYrqsFeMs6TilSXXPoRiKwu8QQ1Dkn3l5lWREv6Q',
    schemaRegistryEndpoint: 'https://psrc-o3gmx9.eastus.azure.confluent.cloud',
    schemaApiKey: '',
    schemaApiSecret: '',
  },
  {
    id: 'cat-gcp',
    displayName: 'CAT GCP',
    environment: 'cat',
    cloudProvider: 'GCP',
    clusterId: 'lkc-10v633',
    restEndpoint: 'https://lkc-10v633.domqwxeqxpl.us-east4.gcp.confluent.cloud',
    apiKey: '4J5CJJRZIYU6SXUL',
    apiSecret: 'cfltUFLU8Tu+JYU7LuPT+LBUI/a501gW3LTJzqkwENZBK25Ut7+As2ihLbSYsv0w',
    schemaRegistryEndpoint: 'https://psrc-j5w608.us-east4.gcp.confluent.cloud',
    schemaApiKey: '6X2LV5VTTUHVR5YQ',
    schemaApiSecret: 'cfltOUvf1G/7jj07OGQCP0LZ3lscvvzOh/D0x68GN/Q1yjUZCdczTMEBX9a7Y/kg',
  },
];

// Helper function to get cluster by ID
export function getClusterById(id: string): ClusterConfig | undefined {
  return CLUSTER_CONFIGS.find(c => c.id === id);
}

// Helper function to get clusters by environment
export function getClustersByEnvironment(env: 'dev' | 'sit' | 'cat' | 'prod'): ClusterConfig[] {
  return CLUSTER_CONFIGS.filter(c => c.environment === env);
}
