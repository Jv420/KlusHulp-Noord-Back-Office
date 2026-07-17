import {SignJWT,jwtVerify} from 'jose';import {cookies} from 'next/headers';
const key=()=>new TextEncoder().encode(process.env.AUTH_SECRET||'development-only-secret-change-me-now');
export type Session={userId:number,email:string,name:string,roles:string[],permissions:string[]};
export async function createToken(s:Session){return new SignJWT(s as any).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('8h').sign(key())}
export async function readSession():Promise<Session|null>{const t=cookies().get('khn_session')?.value;if(!t)return null;try{return (await jwtVerify(t,key())).payload as any}catch{return null}}
export function can(s:Session|null,p:string){return !!s&&(s.permissions.includes('*')||s.permissions.includes(p))}
