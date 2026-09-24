/** Installs need the one-time install code TrulyYou emails after approving a request at docs.truly.you. */
export async function checkInstallCode({installCode,ownerEmail,origin,controlOrigin},http=fetch){
 const code=String(installCode??'').trim();
 if(!/^[a-f0-9-]{36}\.[A-Za-z0-9_-]{43}$/.test(code))throw Error('Enter the install code from your TrulyYou approval email. Request one at https://docs.truly.you/?guide=self-host.');
 const response=await http(controlOrigin+'/v1/installations/check',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({installCode:code,ownerEmail:ownerEmail.trim().toLowerCase(),...(origin?{origin}:{})}),signal:AbortSignal.timeout(15000)});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(result.message??'The install code could not be checked. Try again shortly.');
 return {installCode:code,company:result.company,activated:result.activated};
}
