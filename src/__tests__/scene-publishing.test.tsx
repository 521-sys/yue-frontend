import {it,expect,vi,afterEach}from'vitest';
import{render,screen,fireEvent,cleanup}from'@testing-library/react';
import SceneDialogueScreen from'../screens/SceneDialogueScreen';
vi.mock('../lib/speech',()=>({speak:vi.fn(),stopSpeak:vi.fn(),playSceneAudio:vi.fn()}));
afterEach(()=>{cleanup();vi.restoreAllMocks();localStorage.clear()});
it('does not show bundled scenes when server catalog is empty',async()=>{vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('[]'));render(<SceneDialogueScreen/>);await screen.findByText('暂无已发布的场景');expect(screen.queryByText('茶餐厅点餐')).toBeNull()});
it('rechecks a scene when opened and hides offline content',async()=>{
 vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify([{id:7,title:'测试点餐',place:'香港',roleA:'A',roleB:'B',lines:[]}]))).mockResolvedValueOnce(new Response('{"error":"场景已下架"}',{status:404}));
 render(<SceneDialogueScreen/>);fireEvent.click(await screen.findByText('测试点餐'));await screen.findByText('场景已下架');expect(screen.queryByText('测试点餐')).toBeNull();
});
it('loads a requested favorite directly and reports that the request was consumed',async()=>{
 const handled=vi.fn();
 vi.spyOn(globalThis,'fetch')
  .mockResolvedValueOnce(new Response('[]'))
  .mockResolvedValueOnce(new Response(JSON.stringify({id:7,title:'收藏场景',place:'香港',roleA:'店员',roleB:'客人',lines:[]})));
 render(<SceneDialogueScreen requestedSceneId={7} onRequestHandled={handled}/>);
 expect(await screen.findByText(/收藏场景/)).toBeInTheDocument();
 expect(handled).toHaveBeenCalledTimes(1);
});
it('requested scene missing or offline falls back to the list with the server error',async()=>{
 const handled=vi.fn();
 vi.spyOn(globalThis,'fetch')
  .mockResolvedValueOnce(new Response(JSON.stringify([{id:7,title:'旧场景',place:'香港',roleA:'A',roleB:'B',lines:[]}])) )
  .mockResolvedValueOnce(new Response('{"error":"场景已下架"}',{status:404}));
 render(<SceneDialogueScreen requestedSceneId={7} onRequestHandled={handled}/>);
 expect(await screen.findByRole('alert')).toHaveTextContent('场景已下架');
 expect(screen.queryByText('旧场景')).not.toBeInTheDocument();
 expect(handled).toHaveBeenCalledTimes(1);
});
