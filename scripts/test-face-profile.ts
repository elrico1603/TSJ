import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { FACE_MODEL, validFaceSamples, faceSimilarity, samplesMatch, encryptFaceProfile, decryptFaceProfile } from '../server/faceProfiles/profileCrypto';

const a = Array.from({length:1024},(_,i)=>i%2===0?1:-1);
const b = a.map(n=>-n);
const profile = [a.slice(),a.slice(),a.slice()];
const different = [b.slice(),b.slice(),b.slice()];
const key = randomBytes(32);
let count=0;
function check(name:string,fn:()=>void){fn();console.log('PASS '+name);count++;}
check('three finite nonzero descriptors required',()=>{
  assert.equal(validFaceSamples(profile),true);
  assert.equal(validFaceSamples([a,a]),false);
  assert.equal(validFaceSamples([a,a,[NaN]]),false);
  assert.equal(validFaceSamples([a,a,Array(1024).fill(0)]),false);
});
check('same descriptor matches',()=>assert.equal(faceSimilarity(a,a),1));
check('different synthetic descriptor rejected',()=>assert.equal(samplesMatch(profile,different),false));
check('every presented frame must match',()=>{
  assert.equal(samplesMatch(profile,profile),true);
  assert.equal(samplesMatch(profile,[a,a,b]),false);
});
const encrypted=encryptFaceProfile('fictional-employee-a',profile,key);
check('encrypted record contains no readable descriptor arrays',()=>{
  assert.equal(encrypted.model,FACE_MODEL);
  assert.ok(!JSON.stringify(encrypted).includes(JSON.stringify(a)));
});
check('encrypted profile round trip',()=>assert.deepEqual(decryptFaceProfile('fictional-employee-a',encrypted,key),profile));
check('profile cannot move to another employee',()=>assert.throws(()=>decryptFaceProfile('fictional-employee-b',encrypted,key)));
check('wrong key fails closed',()=>assert.throws(()=>decryptFaceProfile('fictional-employee-a',encrypted,randomBytes(32))));
check('modified ciphertext fails closed',()=>{
  const bytes=Buffer.from(encrypted.ciphertext,'base64');
  bytes[0]^=1;
  assert.throws(()=>decryptFaceProfile('fictional-employee-a',{...encrypted,ciphertext:bytes.toString('base64')},key));
});
console.log('All '+count+' synthetic face profile tests passed.');
console.log('These checks are not real camera, biometric accuracy or production security certification.');
