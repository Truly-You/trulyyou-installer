/** Runs inside the customer's build account. No credentials go to TrulyYou. */
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createHash,randomBytes} from 'node:crypto';
import {checkInstallCode} from './install-code.mjs';
import {dashboardAddress} from './address.mjs';
import os from 'node:os';import path from 'node:path';
const root=process.cwd(),config=JSON.parse(await readFile('wrangler.jsonc','utf8'));
// TrulyYou-controlled values ship with the pinned release, not in the customer's form.
const release=JSON.parse(await readFile('release.json','utf8'));
const control=config.vars.CONTROL_ORIGIN||release.controlOrigin;
const account=process.env.CLOUDFLARE_ACCOUNT_ID||config.vars.CLOUDFLARE_ACCOUNT_ID;
const owner=process.env.OWNER_EMAIL||config.vars.OWNER_EMAIL;
const zone=process.env.CLOUDFLARE_ZONE_ID||config.vars.CLOUDFLARE_ZONE_ID;
// Deploy-button secrets are already attached to the Worker, not exposed to Builds.
// Use the build credential only for deployment; never persist it as the runtime token.
const token=process.env.PROVISIONING_TOKEN||process.env.CLOUDFLARE_API_TOKEN;
const hostname=process.env.DASHBOARD_HOSTNAME||config.vars.DASHBOARD_HOSTNAME;
const installCode=process.env.INSTALL_CODE||config.vars.INSTALL_CODE;
const signin=(process.env.SIGNIN_HOSTNAME||config.vars.SIGNIN_HOSTNAME||'').trim().toLowerCase();
if(signin&&signin===hostname?.trim().toLowerCase())throw Error('Use a different hostname for SIGNIN_HOSTNAME and DASHBOARD_HOSTNAME.');
dashboardAddress(hostname,config.name,'validation');
if(!token)throw Error('Cloudflare build credentials are unavailable. For a local deployment, set PROVISIONING_TOKEN.');
if(!/^[a-f0-9]{32}$/.test(account??''))throw Error('Set CLOUDFLARE_ACCOUNT_ID before deploying.');
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner??''))throw Error('Set OWNER_EMAIL to the designated owner before deploying.');
if(!/^[a-f0-9]{32}$/.test(zone??''))throw Error('Set CLOUDFLARE_ZONE_ID to an active zone in your account before deploying.');
const temporary=await mkdtemp(path.join(os.tmpdir(),'trulyyou-deploy-'));
const env={...process.env,CLOUDFLARE_ACCOUNT_ID:account,CLOUDFLARE_API_TOKEN:token,DOCKER_CONFIG:temporary,WRANGLER_SEND_METRICS:'false'};
const run=(command,args,input,capture=false)=>new Promise((resolve,reject)=>{
 const child=spawn(command,args,{env,stdio:['pipe','pipe','pipe']});let output='',error='';
 child.stdout.on('data',bytes=>{output+=bytes;if(!capture)process.stdout.write(bytes);});child.stderr.on('data',bytes=>{error+=bytes;if(!capture)process.stderr.write(bytes);});
 child.on('error',reject);child.on('exit',code=>code===0?resolve(output.trim()):reject(Error('Installation command failed: '+path.basename(command))));child.stdin.end(input);
});
try{
 if(!process.env.PROVISIONING_TOKEN){
  const name=process.env.WRANGLER_CI_OVERRIDE_NAME||config.name;
  const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${encodeURIComponent(name)}/secrets`,{headers:{authorization:`Bearer ${token}`}});
  const saved=await response.json();
  if(!response.ok||!saved.success||!saved.result?.some(secret=>secret.name==='PROVISIONING_TOKEN'))throw Error('Enter PROVISIONING_TOKEN in the Cloudflare deployment form before deploying.');
 }
 // Only an approved install code may install, and only for this owner and dashboard.
 const {installCode:setupToken,company}=await checkInstallCode({installCode,ownerEmail:owner,origin:hostname?'https://'+hostname.trim().toLowerCase():undefined,controlOrigin:control});
 console.log(`Install code accepted for ${company}.`);
 const platform=os.platform()==='darwin'&&os.arch()==='arm64'?'Darwin_arm64':os.platform()==='linux'&&os.arch()==='x64'?'Linux_x86_64':null;
 if(!platform)throw Error('The installer supports Cloudflare Builds (Linux x64) and Apple Silicon.');
 const checksums={Darwin_arm64:'2231fc8df8806d20d680ff1225db44e095a55dd6ac1ae8eced4faf4b278b78fb',Linux_x86_64:'0ab7a1d6932a213aed964ce97666c3077fe691c8606413674a8b3e0b9ec4cda0'};
 const archive=await fetch(`https://github.com/google/go-containerregistry/releases/download/v0.22.1/go-containerregistry_${platform}.tar.gz`);if(!archive.ok)throw Error('Image-copy tool unavailable.');
 const bytes=Buffer.from(await archive.arrayBuffer());if(createHash('sha256').update(bytes).digest('hex')!==checksums[platform])throw Error('Image-copy tool checksum mismatch.');
 await writeFile(path.join(temporary,'crane.tar.gz'),bytes);await run('tar',['-xzf',path.join(temporary,'crane.tar.gz'),'-C',temporary,'crane']);
 const crane=path.join(temporary,'crane');
 const api=async(route,body)=>{const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${route}`,{method:body?'POST':'GET',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok||!data.success)throw Error('Cloudflare setup failed: '+route);return data.result;};
 const credentials=await api('/containers/registries/registry.cloudflare.com/credentials',{expiration_minutes:60,permissions:['push','pull']});
 await run(crane,['auth','login','registry.cloudflare.com','--username',credentials.username,'--password-stdin'],credentials.password,true);
 const images={};
 const downloadToken=process.env.DOWNLOAD_TOKEN||setupToken;
 await mkdir('.generated',{recursive:true});
 let claim;try{claim=JSON.parse(await readFile('.generated/download-claim.json','utf8'));}catch{claim={tokenHash:createHash('sha256').update(downloadToken).digest('hex'),nonce:randomBytes(32).toString('base64url')};await writeFile('.generated/download-claim.json',JSON.stringify(claim),{mode:0o600});}
 if(claim.tokenHash!==createHash('sha256').update(downloadToken).digest('hex')){claim={tokenHash:createHash('sha256').update(downloadToken).digest('hex'),nonce:randomBytes(32).toString('base64url')};await writeFile('.generated/download-claim.json',JSON.stringify(claim),{mode:0o600});}
 for(const name of ['dashboard','gateway']){
  // One tag per source image: reusing a tag can read back the previous image straight after the push.
  const destination=`registry.cloudflare.com/${account}/trulyyou-${name}:${release.images[name].split('@')[1].replace(':','-')}`;
  const grantResponse=await fetch(control+'/v1/installations/download',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:downloadToken,claim:claim.nonce,component:name,image:release.images[name]}),redirect:'error'});
  if(!grantResponse.ok)throw Error('Private release authorization failed. Check your setup/download grant.');
  const grant=await grantResponse.json();if(grant.image!==release.images[name]||grant.registry!=='ghcr.io'||typeof grant.registryToken!=='string')throw Error('Release authorization does not match the pinned image.');
  const auth=JSON.parse(await readFile(path.join(temporary,'config.json'),'utf8'));auth.auths['ghcr.io']={registrytoken:grant.registryToken};await writeFile(path.join(temporary,'config.json'),JSON.stringify(auth),{mode:0o600});
  console.log(`Copying ${name} image into your Cloudflare account.`);
  await run(crane,['copy','--platform','linux/amd64',release.images[name],destination]);
  const digest=await run(crane,['digest',destination],undefined,true);images[name]=destination.split(':')[0]+'@'+digest;
 }
 const subdomain=await api('/workers/subdomain');
 const name=process.env.WRANGLER_CI_OVERRIDE_NAME||config.name;
 const address=dashboardAddress(hostname,name,subdomain.subdomain);
 config.name=name;config.account_id=account;config.containers[0].image=images.dashboard;
 if(address.routes)config.routes=address.routes;
 config.vars={...config.vars,CONTROL_ORIGIN:control,ANDROID_CERT_FINGERPRINT:config.vars.ANDROID_CERT_FINGERPRINT||release.androidCertificate,...(signin?{SIGNIN_HOSTNAME:signin}:{}),COMPANY_NAME:company,DASHBOARD_WORKER_NAME:name,OWNER_EMAIL:owner,CLOUDFLARE_ZONE_ID:zone,CLOUDFLARE_ACCOUNT_ID:account,GATEWAY_IMAGE:images.gateway,DASHBOARD_ORIGIN:hostname?address.origin:(config.vars.DASHBOARD_ORIGIN||address.origin)};
 delete config.vars.INSTALL_CODE;
 await mkdir('.generated',{recursive:true});await writeFile('.generated/wrangler.json',JSON.stringify({...config,main:path.resolve(root,config.main)},null,2));
 const secretsFile=path.join(temporary,'bootstrap-secrets.json');await writeFile(secretsFile,JSON.stringify({SETUP_TOKEN:setupToken,PROVISIONING_TOKEN:process.env.PROVISIONING_TOKEN}),{mode:0o600});
 const dashboardApp=`${name}-dashboard`;
 const findDashboard=async()=>(await api(`/containers/applications?name=${encodeURIComponent(dashboardApp)}`)).find(application=>application.name===dashboardApp);
 const previousImage=(await findDashboard().catch(()=>undefined))?.configuration?.image;
 const deploy=()=>run(process.execPath,[path.join(root,'node_modules/wrangler/bin/wrangler.js'),'deploy','--config','.generated/wrangler.json','--secrets-file',secretsFile,'--containers-rollout','immediate']);
 await deploy();
 // A new Worker version restarts the dashboard before Cloudflare finishes rolling out a new image,
 // so an upgrade would restart on the old one. Wait for the rollout, then restart once more.
 const current=previousImage&&await findDashboard();
 if(current&&current.configuration?.image!==previousImage){
  console.log('Waiting for the new dashboard image to roll out.');
  for(let attempt=0;attempt<60;attempt++){
   const rollouts=await api(`/containers/applications/${current.id}/rollouts`);
   if(rollouts.some(rollout=>rollout.target_configuration?.image===current.configuration.image&&rollout.status==='completed'))break;
   if(attempt===59)throw Error('The dashboard image rollout did not finish. Redeploy to retry.');
   await new Promise(resolve=>setTimeout(resolve,10_000));
  }
  await deploy();
 }
 console.log('Dashboard: '+config.vars.DASHBOARD_ORIGIN);
}finally{await rm(temporary,{recursive:true,force:true});}
