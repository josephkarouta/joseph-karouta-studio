export async function exportAssets(project:any,brand:any){
return{
svg:`${project?.project_name||"brand"}-logo.svg`,
png:`${project?.project_name||"brand"}-logo.png`,
json:JSON.stringify({project,brand},null,2)
};
}
