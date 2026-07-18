import {NextResponse} from 'next/server';
import {can,readSession} from '@/lib/auth';
import {getStripe} from '@/lib/stripe';

export async function POST(){
 try{
  const session=await readSession();
  if(!can(session,'data.write'))return NextResponse.json({error:'Geen toegang'},{status:403});
  const token=await getStripe().terminal.connectionTokens.create();
  return NextResponse.json({secret:token.secret});
 }catch(error:any){return NextResponse.json({error:error?.message||'Terminal-token kon niet worden aangemaakt'},{status:500});}
}
