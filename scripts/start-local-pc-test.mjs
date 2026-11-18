import {spawn} from 'node:child_process';
const env={...process.env,
  TSJ_LOCAL_PC_TEST:'true',FIREBASE_PROJECT_ID:'timbersmith-staging',
  FIRESTORE_EMULATOR_HOST:'127.0.0.1:8085',
  FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099',
  TSJ_MANAGED_USER_API:'true',VITE_TSJ_LOCAL_PC_TEST:'true',
  VITE_TSJ_MANAGED_USER_API_BASE_URL:'http://127.0.0.1:3000',
  VITE_TSJ_MANAGED_USER_UI:'true',VITE_FIREBASE_LOGIN_PILOT:'true',
  PORT:'3000'
};
async function main(){
  const response=await fetch('http://127.0.0.1:4400/emulators');
  if(!response.ok)throw Error('Local Firebase Emulator Hub is not running.');
  const services=await response.json();
  if(!services.auth||!services.firestore)throw Error('Both Auth and Firestore emulators are required.');
  const child=spawn(process.execPath,['node_modules/tsx/dist/cli.mjs','server.ts'],{
    env,stdio:'inherit',windowsHide:false
  });
  for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>child.kill(sig));
  child.on('exit',code=>process.exit(code??0));
}
main().catch(error=>{console.error('LOCAL PC TEST:',error.message);process.exitCode=1});
