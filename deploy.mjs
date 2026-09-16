/** Runs inside the customer's build account. No credentials go to TrulyYou. */
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import os from 'node:os';import path from 'node:path';
const root=process.cwd(),config=JSON.parse(await readFile('wrangler.jsonc','utf8'));
const account=process.env.CLOUDFLARE_ACCOUNT_ID||config.vars.CLOUDFLARE_ACCOUNT_ID;
const token=process.env.CLOUDFLARE_API_TOKEN;
if(!/^[a-f0-9]{32}$/.test(account??'')||!token)throw Error('Deploy with CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in the build environment.');
const temporary=await mkdtemp(path.join(os.tmpdir(),'trulyyou-deploy-'));
const env={...process.env,CLOUDFLARE_ACCOUNT_ID:account,DOCKER_CONFIG:temporary,WRANGLER_SEND_METRICS:'false'};
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
 for(const name of ['dashboard','gateway']){
  const destination=`registry.cloudflare.com/${account}/trulyyou-${name}:${release.version}`;
  console.log(`Copying ${name} image into your Cloudflare account.`);
  await run(crane,['copy','--platform','linux/amd64',release.images[name],destination]);
  const digest=await run(crane,['digest',destination],undefined,true);images[name]=destination.split(':')[0]+'@'+digest;
 }
 const subdomain=await api('/workers/subdomain');
 const name=process.env.WRANGLER_CI_OVERRIDE_NAME||config.name;
 config.name=name;config.account_id=account;config.containers[0].image=images.dashboard;
 config.vars={...config.vars,CLOUDFLARE_ACCOUNT_ID:account,GATEWAY_IMAGE:images.gateway,DASHBOARD_ORIGIN:config.vars.DASHBOARD_ORIGIN||`https://${name}.${subdomain.subdomain}.workers.dev`};
 await mkdir('.generated',{recursive:true});await writeFile('.generated/wrangler.json',JSON.stringify({...config,main:path.resolve(root,config.main)},null,2));
 await run(process.execPath,[path.join(root,'node_modules/wrangler/bin/wrangler.js'),'deploy','--config','.generated/wrangler.json','--containers-rollout','immediate']);
 console.log('Dashboard: '+config.vars.DASHBOARD_ORIGIN);
}finally{await rm(temporary,{recursive:true,force:true});}
