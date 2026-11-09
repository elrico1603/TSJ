/** Demo project only; no deployment command and no credentials required. */
import {spawn} from 'node:child_process';
import {readdirSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),runtime=new URL('.local/java21/',root);
const javaFolder=readdirSync(runtime,{withFileTypes:true}).find(entry=>entry.isDirectory()&&existsSync(new URL(entry.name+'/bin/java.exe',runtime)));
if(!javaFolder)throw new Error('Portable Java 21 runtime is required in .local/java21.');
const javaHome=fileURLToPath(new URL(javaFolder.name+'/',runtime)),cache=fileURLToPath(new URL('.local/firebase-emulators/',root));mkdirSync(cache,{recursive:true});
// Keep emulators:exec's script argument free of nested Windows shell quotes.
writeFileSync(new URL('.local/tsj-clock-emulator-worker.cmd',root),'@echo off\r\ncd /d "%~dp0.."\r\ncall npx tsx scripts/test-clock-browser.ts --emulators\r\nexit /b %errorlevel%\r\n');
const command=process.platform==='win32'?(process.env.ComSpec||'cmd.exe'):'npx';
const argumentsList=['--yes','firebase-tools@latest','emulators:exec','--config=config/firebase.clocking-emulators.json','--project=demo-tsj-clock-test','--only=firestore,auth','npx tsx scripts/test-clock-browser.ts --emulators'];
const args=process.platform==='win32'?['/d','/s','/c','npx --yes firebase-tools@latest emulators:exec --config=config/firebase.clocking-emulators.json --project=demo-tsj-clock-test --only=firestore,auth tsj-clock-emulator-worker.cmd']:argumentsList;
const child=spawn(command,args,{cwd:fileURLToPath(root),windowsHide:true,stdio:'inherit',env:{...process.env,
  PATH:fileURLToPath(new URL('.local/',root))+';'+javaHome+'bin;'+process.env.PATH,JAVA_HOME:javaHome,FIREBASE_EMULATORS_PATH:cache,CI:'true',
  GOOGLE_CLOUD_PROJECT_ID:'demo-tsj-clock-test',GCLOUD_PROJECT:'demo-tsj-clock-test',FIREBASE_TOKEN:''}});
child.on('exit',code=>{process.exitCode=code??1;});child.on('error',error=>{console.error(error.message);process.exitCode=1;});
