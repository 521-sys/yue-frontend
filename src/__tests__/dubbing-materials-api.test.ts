import {afterEach,expect,it,vi} from "vitest";
import {loadDubbingMaterials} from "../lib/dubbing-materials-api";

afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals()});

const payload=[{id:"movie",title:"电影",difficulty:"B1",tags:["家庭"],sourceLabel:"来源",sourceUrl:"https://example.com/source",licenseLabel:"CC BY",licenseUrl:"https://example.com/license",parts:[{id:"part-1",label:"Part 01",title:"开场",videoSrc:"/api/public/dubbing-materials/movie/parts/part-1/video?v=1",cues:[{id:"cue-1",startMs:0,endMs:1000,text:"你好"}]}]}];

it("loads the complete public dubbing catalog",async()=>{
 const fetcher=vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response(JSON.stringify(payload),{status:200,headers:{"Content-Type":"application/json"}}));
 await expect(loadDubbingMaterials()).resolves.toEqual(payload);
 expect(fetcher).toHaveBeenCalledWith("/api/public/dubbing-materials",{signal:undefined});
});

it("accepts an empty published catalog",async()=>{
 vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response("[]",{status:200}));
 await expect(loadDubbingMaterials()).resolves.toEqual([]);
});

it.each([
 {},
 [{...payload[0],tags:"家庭"}],
 [{...payload[0],parts:[{...payload[0].parts[0],videoSrc:"",cues:[]}]}],
 [{...payload[0],parts:[{...payload[0].parts[0],cues:[{id:"cue",startMs:1000,endMs:500,text:"错"}]}]}],
])("rejects a malformed catalog without returning partial data",async(value)=>{
 vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response(JSON.stringify(value),{status:200}));
 await expect(loadDubbingMaterials()).rejects.toThrow("电影配音素材数据不完整");
});

it("reports request failures and forwards abort signals",async()=>{
 const controller=new AbortController();const fetcher=vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response("服务异常",{status:503}));
 await expect(loadDubbingMaterials(controller.signal)).rejects.toThrow("电影配音素材加载失败");
 expect(fetcher).toHaveBeenCalledWith("/api/public/dubbing-materials",{signal:controller.signal});
});
