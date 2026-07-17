import {NextResponse} from 'next/server';import {readSession} from '@/lib/auth';export async function GET(){return NextResponse.json(await readSession())}
