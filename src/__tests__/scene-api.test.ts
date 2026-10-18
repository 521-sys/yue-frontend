import {it,expect,vi,afterEach,beforeEach}from'vitest';
import{listPublishedScenes,getPublishedScene,listFavoriteScenes,unfavoriteScene}from'../lib/scene-api';
beforeEach(()=>localStorage.clear());
afterEach(()=>vi.restoreAllMocks());
it('maps official ids and uploaded audio without changing local ids',async()=>{
 vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify([{id:7,code:'tea',title:'茶餐厅',place:'香港',roleA:'店员',roleB:'客人',lines:[{speaker:'A',cantoneseText:'唔该',mandarinText:'谢谢',jyutping:'m4 goi1',audioKey:'upload:abc'}]}])));
 const items=await listPublishedScenes();expect(items[0].id).toBe('official:7');expect(items[0].lines[0].audioUrl).toContain('/audio/uploads/abc');expect(items[0].lines[0].jyutping).toBe('m4 goi1');
});
it('empty server results never restore bundled scenes',async()=>{vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('[]'));expect(await listPublishedScenes()).toEqual([])});
it('unpublished details fail rather than returning old content',async()=>{vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('{"error":"场景已下架"}',{status:404}));await expect(getPublishedScene(7)).rejects.toThrow('场景已下架')});

it('loads favorites with bearer auth and the shared scene mapper',async()=>{
 localStorage.setItem('yueToken','favorite-token');
 const request=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify([{id:7,title:'茶餐厅',place:'香港',roleA:'店员',roleB:'客人',lines:[]}])));
 const items=await listFavoriteScenes();
 expect(request).toHaveBeenCalledWith('https://gnep.online/api/scenes/favorites',expect.objectContaining({headers:expect.objectContaining({Authorization:'Bearer favorite-token'})}));
 expect(items[0]).toEqual(expect.objectContaining({id:'official:7',title:'茶餐厅',roles:['店员','客人']}));
});

it('removes a favorite through the authenticated endpoint',async()=>{
 localStorage.setItem('yueToken','favorite-token');
 const request=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(null,{status:204}));
 await unfavoriteScene(7);
 expect(request).toHaveBeenCalledWith('https://gnep.online/api/scenes/7/favorite',expect.objectContaining({method:'DELETE',headers:expect.objectContaining({Authorization:'Bearer favorite-token'})}));
});

it.each([0,-1,1.5,Number.NaN])('rejects invalid favorite id %s before fetch',async(id)=>{
 const request=vi.spyOn(globalThis,'fetch');
 await expect(unfavoriteScene(id)).rejects.toThrow('场景不存在');
 expect(request).not.toHaveBeenCalled();
});

it('preserves the server message when unfavorite fails',async()=>{
 vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('{"error":"收藏不存在"}',{status:404}));
 await expect(unfavoriteScene(7)).rejects.toThrow('收藏不存在');
});
