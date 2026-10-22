import type {DubbingMaterial} from "../data/dubbing-materials";

const completeString=(value:unknown)=>typeof value==="string"&&value.trim().length>0;

function isCatalog(value:unknown):value is DubbingMaterial[]{
 if(!Array.isArray(value))return false;
 return value.every(material=>{
  if(!material||typeof material!=="object")return false;
  const item=material as Record<string,unknown>;
  if(!["id","title","difficulty","sourceLabel","sourceUrl","licenseLabel","licenseUrl"].every(key=>completeString(item[key]))||!Array.isArray(item.tags)||!item.tags.every(completeString)||!Array.isArray(item.parts)||!item.parts.length)return false;
  return item.parts.every(part=>{
   if(!part||typeof part!=="object")return false;const p=part as Record<string,unknown>;
   if(!["id","label","title","videoSrc"].every(key=>completeString(p[key]))||!Array.isArray(p.cues)||!p.cues.length)return false;
   return p.cues.every(cue=>{if(!cue||typeof cue!=="object")return false;const c=cue as Record<string,unknown>;return completeString(c.id)&&completeString(c.text)&&typeof c.startMs==="number"&&Number.isFinite(c.startMs)&&c.startMs>=0&&typeof c.endMs==="number"&&Number.isFinite(c.endMs)&&c.endMs>c.startMs});
  });
 });
}

export async function loadDubbingMaterials(signal?:AbortSignal):Promise<DubbingMaterial[]>{
 const response=await fetch("/api/public/dubbing-materials",{signal});
 if(!response.ok)throw new Error("电影配音素材加载失败，请稍后重试");
 const value:unknown=await response.json().catch(()=>undefined);
 if(!isCatalog(value))throw new Error("电影配音素材数据不完整，请稍后重试");
 return value;
}
