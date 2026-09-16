import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes,randomUUID} from 'node:crypto';
/** Generate locally and checkpoint before registration. No credential in URLs or logs. */
export async function registerInstallation({file,provider,ownerEmail,company,controlOrigin},http=fetch){
 const identity={provider,ownerEmail:ownerEmail.trim().toLowerCase(),company:company.trim()};
 let saved;
 try{saved=JSON.parse(await readFile(file,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
 if(saved&&JSON.stringify(saved.identity)!==JSON.stringify(identity))throw Error('Installation owner or company changed. Use a new installation directory.');
 if(!saved){saved={identity,installationId:randomUUID(),claim:randomBytes(32).toString('base64url')};await writeFile(file,JSON.stringify(saved),{mode:0o600});}
 if(!saved.registered){
  const response=await http(controlOrigin+'/v1/setup/install',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...identity,installationId:saved.installationId,claim:saved.claim}),redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Could not register this installation. Retry shortly using the same installation directory.');
  const result=await response.json();if(result.installationId!==saved.installationId)throw Error('Installation registration did not match.');
  saved.registered=true;await writeFile(file,JSON.stringify(saved),{mode:0o600});
 }
 return saved.installationId+'.'+saved.claim;
}
