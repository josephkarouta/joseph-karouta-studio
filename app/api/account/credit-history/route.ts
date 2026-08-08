import { NextResponse } from "next/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";
export async function GET(request:Request){try{const {user,admin}=await requireApiUser(request);const {data,error}=await admin.from('credit_usage_events').select('*').eq('user_id',user.id).order('created_at',{ascending:false}).limit(100);if(error)throw error;return NextResponse.json({events:data||[]});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Unable to load credit history.'},{status:error instanceof ApiAuthError?error.status:500});}}
