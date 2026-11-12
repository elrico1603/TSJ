// Experimental thresholds, deliberately not production-certified.
export const LIMITS = Object.freeze({confidence:0.60, real:0.70, live:0.70, similarity:0.65, minSize:160, samples:3});
export const validVector = value => Array.isArray(value) && value.length === 1024 && value.every(Number.isFinite);
export function frameCheck(result) {
  if (!Array.isArray(result?.face) || result.face.length !== 1) {
    return {ok:false, reason:'Exactly one face must be visible.'};
  }
  const f=result.face[0];
  const confidence=f.faceScore ?? f.boxScore;
  if (!Number.isFinite(confidence) || confidence<LIMITS.confidence) return {ok:false,reason:'Face confidence is too low. Improve lighting.'};
  if (!Array.isArray(f.box) || f.box.length<4 || !f.box.slice(2,4).every(Number.isFinite) ||
      Math.min(f.box[2],f.box[3])<LIMITS.minSize) return {ok:false,reason:'Move closer until your face fills the oval.'};
  if (!Number.isFinite(f.real) || f.real<LIMITS.real) return {ok:false,reason:'Anti-spoof check did not pass.'};
  if (!Number.isFinite(f.live) || f.live<LIMITS.live) return {ok:false,reason:'Liveness check did not pass.'};
  if (!validVector(f.embedding)) return {ok:false,reason:'Face descriptor unavailable.'};
  return {ok:true,face:f};
}
export function matchScore(engine,a,b) {
  if (!validVector(a)||!validVector(b)) return null;
  const score=engine.match.similarity(a,b,{order:2,multiplier:25,min:0.2,max:0.8});
  return Number.isFinite(score) && score>=0 && score<=1 ? score : null;
}
// Every verification frame must agree with a majority of the enrollment
// samples. An unavailable score never becomes a positive match.
export function profileMatch(engine,profile,embedding) {
  if (!Array.isArray(profile)||profile.length!==LIMITS.samples) return null;
  const scores=profile.map(sample=>matchScore(engine,sample,embedding));
  if(scores.some(s=>s===null))return null;
  return scores.sort((a,b)=>a-b)[1];
}
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function eyeRatio(mesh,ids) {
  const pts=ids.map(i=>mesh?.[i]);
  if(pts.some(p=>!Array.isArray(p)||!p.slice(0,2).every(Number.isFinite)||p.length<2))return null;
  const width=dist(pts[0],pts[1]);
  return width>0 ? (dist(pts[2],pts[3])+dist(pts[4],pts[5]))/(2*width) : null;
}
export function eyeOpenness(face) {
  const left=eyeRatio(face?.mesh,[33,133,159,145,158,153]);
  const right=eyeRatio(face?.mesh,[362,263,386,374,385,380]);
  return left===null||right===null ? null : Math.min(left,right);
}
export function yawAngle(face) {
  const yaw=face?.rotation?.angle?.yaw;
  return Number.isFinite(yaw) ? yaw : null;
}
