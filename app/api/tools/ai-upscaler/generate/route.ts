import "server-only";
import { NextResponse } from "next/server";
import { requireApiUser, ApiAuthError } from "@/lib/server/auth";
import { CreditError, reserveCredits, commitCredits, refundCredits } from "@/lib/credits/server";

export const runtime="nodejs";
export const maxDuration=60;

export async function POST(request:Request){
  let reservationId:string|null=null; let admin:any=null;
  try{
    const auth=await requireApiUser(request); admin=auth.admin;
    const body=await request.json(); const imageBase64=String(body?.imageBase64||""); const mimeType=["image/png","image/jpeg","image/webp"].includes(body?.mimeType)?body.mimeType:"image/jpeg"; const scale=body?.scale===4?4:2; const model=String(body?.model||"Standard");
    if(!imageBase64)return NextResponse.json({error:"Image is required."},{status:400});
    if(!process.env.TOPAZ_API_KEY)return NextResponse.json({error:"TOPAZ_API_KEY is missing."},{status:503});
    const reservation=await reserveCredits({admin,userId:auth.user.id,action:scale===4?"aiUpscale4x":"aiUpscale2x",metadata:{tool:"ai_upscaler",scale,model}}); reservationId=reservation.id;
    const form=new FormData(); form.append("image",new Blob([Buffer.from(imageBase64,"base64")],{type:mimeType}),String(body?.filename||"source-image")); form.append("scale",String(scale)); form.append("model",mapTopazModel(model)); form.append("output_format","png");
    const endpoint=process.env.TOPAZ_IMAGE_ENDPOINT||"https://api.topazlabs.com/image/v1/enhance/async";
    const response=await fetch(endpoint,{method:"POST",headers:{"X-API-Key":process.env.TOPAZ_API_KEY},body:form}); const data=await response.json(); if(!response.ok)throw new Error(data?.error?.message||data?.message||"Topaz could not start enhancement.");
    const providerId=String(data?.request_id||data?.id||data?.job_id||""); const outputUrl=findOutputUrl(data);
    const {data:job,error}=await admin.from("generation_jobs").insert({user_id:auth.user.id,tool:"ai_upscaler",provider:"topaz",provider_job_id:providerId||null,credit_reservation_id:reservation.id,status:outputUrl?"succeeded":"processing",input:{scale,model,mimeType},output:{provider:data,output_url:outputUrl}}).select().single(); if(error||!job)throw new Error(error?.message||"Enhancement job could not be saved.");
    if(outputUrl)await commitCredits(admin,reservation.id,{provider_job_id:providerId});
    return NextResponse.json({success:true,jobId:job.id,status:outputUrl?"succeeded":"processing",creditsReserved:reservation.amount});
  }catch(error){if(reservationId&&admin)await refundCredits(admin,reservationId,error instanceof Error?error.message:"Upscale start failed");console.error("Topaz start error:",error);if(error instanceof ApiAuthError)return NextResponse.json({error:error.message},{status:error.status});if(error instanceof CreditError)return NextResponse.json({error:error.message,code:error.code},{status:error.status});return NextResponse.json({error:error instanceof Error?error.message:"Upscale could not start."},{status:500});}
}
function mapTopazModel(value:string){const key=value.toLowerCase();if(key.includes("low"))return process.env.TOPAZ_MODEL_LOW_RES||"Low Resolution V2";if(key.includes("art"))return process.env.TOPAZ_MODEL_ART||"Art & CG";if(key.includes("text"))return process.env.TOPAZ_MODEL_TEXT||"Text Refine";if(key.includes("strong"))return process.env.TOPAZ_MODEL_STRONG||"Wonder";return process.env.TOPAZ_MODEL_STANDARD||"Standard V2";}
function findOutputUrl(value:any):string|null{if(!value)return null;if(typeof value==="string"&&/^https?:\/\//.test(value))return value;if(Array.isArray(value)){for(const item of value){const found=findOutputUrl(item);if(found)return found;}}else if(typeof value==="object"){for(const [key,item] of Object.entries(value)){if(/output.*url|download.*url|result.*url/i.test(key)&&typeof item==="string"&&/^https?:\/\//.test(item))return item;const found=findOutputUrl(item);if(found&&/output|result|download|url/i.test(key))return found;}}return null;}
