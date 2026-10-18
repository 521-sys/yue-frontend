import type {Dialogue} from '../data/dialogues';
import {authFetch} from './api';
const BASE=import.meta.env.VITE_API_BASE||'https://gnep.online';
async function read(path:string){const r=await fetch(BASE+path);if(!r.ok){const data=await r.json().catch(()=>null);throw new Error(data?.error||'场景读取失败，请重试')}return r.json()}
function mapScene(s:any):Dialogue {
 return {id:'official:'+s.id,title:s.title,place:s.place,emoji:s.emoji||'💬',roles:[s.roleA,s.roleB],
 lines:(s.lines||[]).map((l:any)=>({speaker:l.speaker,yue:l.cantoneseText,man:l.mandarinText,jyutping:l.jyutping,
 audioUrl:l.audioKey?BASE+(l.audioKey.startsWith('upload:')?'/audio/uploads/'+l.audioKey.slice(7):'/audio/'+encodeURIComponent(l.audioKey)):undefined}))};
}
export async function listPublishedScenes():Promise<Dialogue[]>{const data=await read('/api/public/scenes');if(!Array.isArray(data))throw new Error('场景数据格式不正确');return data.map(mapScene)}
export async function getPublishedScene(id:number):Promise<Dialogue>{if(!Number.isSafeInteger(id)||id<1)throw new Error('场景不存在');return mapScene(await read('/api/public/scenes/'+id))}
export async function listFavoriteScenes():Promise<Dialogue[]>{const response=await authFetch('/api/scenes/favorites');const data=await response.json();if(!Array.isArray(data))throw new Error('收藏数据格式不正确');return data.map(mapScene)}
export async function unfavoriteScene(id:number):Promise<void>{if(!Number.isSafeInteger(id)||id<1)throw new Error('场景不存在');await authFetch('/api/scenes/'+id+'/favorite',{method:'DELETE'})}
