/** Resolve the public address before downloading images or creating resources. */
export function dashboardAddress(hostname, workerName, workersSubdomain) {
 const host=(hostname||'').trim().toLowerCase();
 if(!host)return {origin:`https://${workerName}.${workersSubdomain}.workers.dev`};
 if(host.length>253||!host.includes('.')||!/[a-z]$/.test(host)||host.split('.').some(label=>! /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)))throw Error('DASHBOARD_HOSTNAME must be a hostname, without https://, a port or a path.');
 return {origin:`https://${host}`,routes:[{pattern:host,custom_domain:true}]};
}
