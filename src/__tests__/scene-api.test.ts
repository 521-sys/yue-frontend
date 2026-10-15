import {it,expect,vi,afterEach}from'vitest';
import{listPublishedScenes,getPublishedScene}from'../lib/scene-api';
afterEach(()=>vi.restoreAllMocks());
it('maps official ids and uploaded audio without changing local ids',async()=>{
 vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify([{id:7,code:'tea',title:'茶餐厅',place:'香港',roleA:'店员',roleB:'客人',lines:[{speaker:'A',cantoneseText:'唔该',mandarinText:'谢谢',jyutping:'m4 goi1',audioKey:'upload:abc'}]}])));
 const items=await listPublishedScenes();expect(items[0].id).toBe('official:7');expect(items[0].lines[0].audioUrl).toContain('/audio/uploads/abc');expect(items[0].lines[0].jyutping).toBe('m4 goi1');
});
it('empty server results never restore bundled scenes',async()=>{vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('[]'));expect(await listPublishedScenes()).toEqual([])});
it('unpublished details fail rather than returning old content',async()=>{vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('{"error":"场景已下架"}',{status:404}));await expect(getPublishedScene(7)).rejects.toThrow('场景已下架')});
