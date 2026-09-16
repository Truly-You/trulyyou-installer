/** Runs inside the customer's build account. No credentials go to TrulyYou. */
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createHash,randomBytes} from 'node:crypto';
import os from 'node:os';import path from 'node:path';
const root=process.cwd(),config=JSON.parse(await readFile('wrangler.jsonc','utf8'));
const account=process.env.CLOUDFLARE_ACCOUNT_ID||config.vars.CLOUDFLARE_ACCOUNT_ID;
const owner=process.env.OWNER_EMAIL||config.vars.OWNER_EMAIL;
const zone=process.env.CLOUDFLARE_ZONE_ID||config.vars.CLOUDFLARE_ZONE_ID;
const token=process.env.PROVISIONING_TOKEN;
if(!process.env.PROVISIONING_TOKEN||!process.env.SETUP_TOKEN)throw Error('Set SETUP_TOKEN and PROVISIONING_TOKEN as private build variables before deploying.');
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
 const release=JSON.parse(await readFile('release.json','utf8')),images={};
 const downloadToken=process.env.DOWNLOAD_TOKEN||process.env.SETUP_TOKEN;
 if(!downloadToken)throw Error('Set your setup token as a build secret to retrieve the private release images.');
 await mkdir('.generated',{recursive:true});
 let claim;try{claim=JSON.parse(await readFile('.generated/download-claim.json','utf8'));}catch{claim={tokenHash:createHash('sha256').update(downloadToken).digest('hex'),nonce:randomBytes(32).toString('base64url')};await writeFile('.generated/download-claim.json',JSON.stringify(claim),{mode:0o600});}
 if(claim.tokenHash!==createHash('sha256').update(downloadToken).digest('hex')){claim={tokenHash:createHash('sha256').update(downloadToken).digest('hex'),nonce:randomBytes(32).toString('base64url')};await writeFile('.generated/download-claim.json',JSON.stringify(claim),{mode:0o600});}
 for(const name of ['dashboard','gateway']){
  const destination=`registry.cloudflare.com/${account}/trulyyou-${name}:${release.version}`;
  const grantResponse=await fetch(config.vars.CONTROL_ORIGIN+'/v1/installations/download',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:downloadToken,claim:claim.nonce,component:name}),redirect:'error'});
  if(!grantResponse.ok)throw Error('Private release authorization failed. Check your setup/download grant.');
  const grant=await grantResponse.json();if(grant.image!==release.images[name]||grant.registry!=='ghcr.io'||typeof grant.registryToken!=='string')throw Error('Release authorization does not match the pinned image.');
  const auth=JSON.parse(await readFile(path.join(temporary,'config.json'),'utf8'));auth.auths['ghcr.io']={registrytoken:grant.registryToken};await writeFile(path.join(temporary,'config.json'),JSON.stringify(auth),{mode:0o600});
  console.log(`Copying ${name} image into your Cloudflare account.`);
  await run(crane,['copy','--platform','linux/amd64',release.images[name],destination]);
  const digest=await run(crane,['digest',destination],undefined,true);images[name]=destination.split(':')[0]+'@'+digest;
 }
 const subdomain=await api('/workers/subdomain');
 const name=process.env.WRANGLER_CI_OVERRIDE_NAME||config.name;
 config.name=name;config.account_id=account;config.containers[0].image=images.dashboard;
 config.vars={...config.vars,OWNER_EMAIL:owner,CLOUDFLARE_ZONE_ID:zone,CLOUDFLARE_ACCOUNT_ID:account,GATEWAY_IMAGE:images.gateway,DASHBOARD_ORIGIN:config.vars.DASHBOARD_ORIGIN||`https://${name}.${subdomain.subdomain}.workers.dev`};
 await mkdir('.generated',{recursive:true});await writeFile('.generated/wrangler.json',JSON.stringify({...config,main:path.resolve(root,config.main)},null,2));
 const secretsFile=path.join(temporary,'bootstrap-secrets.json');await writeFile(secretsFile,JSON.stringify({SETUP_TOKEN:process.env.SETUP_TOKEN,PROVISIONING_TOKEN:process.env.PROVISIONING_TOKEN}),{mode:0o600});
 await run(process.execPath,[path.join(root,'node_modules/wrangler/bin/wrangler.js'),'deploy','--config','.generated/wrangler.json','--secrets-file',secretsFile,'--containers-rollout','immediate']);
 console.log('Dashboard: '+config.vars.DASHBOARD_ORIGIN);
}finally{await rm(temporary,{recursive:true,force:true});}
